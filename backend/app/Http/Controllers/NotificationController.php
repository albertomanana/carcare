<?php

namespace App\Http\Controllers;

use App\Http\Requests\Notification\MarkNotificationsReadRequest;
use App\Http\Requests\Notification\NotificationIndexRequest;
use App\Http\Resources\AppNotificationResource;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Avisos en la app (§3.13.8): cada usuario ve y marca solo los suyos. */
class NotificationController extends Controller
{
    public const PER_PAGE = 20;

    public const MAX_PER_PAGE = 50;

    public function __construct(private readonly NotificationService $notifications) {}

    /** `Paginated<AppNotification>`, `created_at` descendente. `?unread=1` solo las no leídas. */
    public function index(NotificationIndexRequest $request): AnonymousResourceCollection
    {
        $perPage = max(1, min((int) $request->query('per_page', (string) self::PER_PAGE), self::MAX_PER_PAGE));

        return AppNotificationResource::collection(
            $this->notifications->list($request->user(), $request->boolean('unread'), $perPage)
        );
    }

    /** `Resource<NotificationCount>`. */
    public function count(Request $request): JsonResponse
    {
        return $this->data(['unread' => $this->notifications->unreadCount($request->user())]);
    }

    /** 204. Sin `ids`, todas. */
    public function read(MarkNotificationsReadRequest $request): Response
    {
        $this->notifications->markAsRead($request->user(), $request->ids());

        return $this->noContent();
    }
}

<?php

namespace App\Enums;

/** Tipo de notificación en la app (contrato §3.13.8). */
enum NotificationKind: string
{
    use EnumHelpers;

    case RequestReceived = 'repair_request.received';
    case RequestCancelled = 'repair_request.cancelled';
    case RequestAccepted = 'repair_request.accepted';
    case RequestRejected = 'repair_request.rejected';
    case QuoteSent = 'repair_quote.sent';
    case QuoteAccepted = 'repair_quote.accepted';
    case QuoteRejected = 'repair_quote.rejected';
    case OrderReady = 'repair_request.order_ready';

    /** true si el aviso va al particular; false si va al owner y los managers del taller. */
    public function forRequester(): bool
    {
        return in_array($this, [self::RequestAccepted, self::RequestRejected, self::QuoteSent, self::OrderReady], true);
    }
}

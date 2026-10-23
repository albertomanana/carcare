<?php

namespace App\Http\Controllers;

use App\Http\Requests\Account\DeleteAccountRequest;
use App\Http\Requests\Account\UpdatePasswordRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\MeResource;
use App\Services\AccountService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/** /me: perfil, contraseña y baja de la cuenta autenticada. */
class MeController extends Controller
{
    public function show(Request $request): MeResource
    {
        return new MeResource($request->user());
    }

    public function update(UpdateProfileRequest $request, AccountService $accounts): MeResource
    {
        return new MeResource($accounts->updateProfile($request->user(), $request->validated()));
    }

    public function password(UpdatePasswordRequest $request, AccountService $accounts): Response
    {
        $accounts->updatePassword($request->user(), $request->validated('password'));

        return $this->noContent();
    }

    public function destroy(DeleteAccountRequest $request, AccountService $accounts): Response
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        $accounts->delete($user);

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return $this->noContent();
    }
}

<?php

namespace App\Enums;

/** Estado de una versión de presupuesto (contrato §3.13.5). Solo una versión puede estar `sent`. */
enum RepairQuoteStatus: string
{
    use EnumHelpers;

    case Sent = 'sent';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Superseded = 'superseded';
}

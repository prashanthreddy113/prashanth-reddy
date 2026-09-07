namespace WaterTanker.Api.Models;

/// <summary>Who is signed in. Operators run tanker fleets; RWA users represent a gated community; Admin runs the platform.</summary>
public enum UserRole { Admin, Operator, Rwa }

public enum DeliveryStatus
{
    /// <summary>Water is flowing (or has just stopped) - totals are still changing.</summary>
    InProgress,
    /// <summary>Flow stopped and the device (or the idle timer) closed the delivery. Totals are final.</summary>
    Completed,
    /// <summary>The community confirmed the delivery.</summary>
    Verified,
    /// <summary>The community raised a dispute that is still open.</summary>
    Disputed,
    /// <summary>Too little water to count as a delivery (a flush/test run) - kept for audit, excluded from billing.</summary>
    Discarded,
}

/// <summary>Bands follow IS 10500 (drinking water): "Good" = acceptable limit, "Acceptable" = permissible limit, otherwise "Poor".</summary>
public enum QualityGrade { Unknown, Good, Acceptable, Poor }

public enum DeviceStatus { Provisioned, Online, Offline, Tampered, Retired }

public enum BookingStatus { Requested, Accepted, Dispatched, Delivered, Cancelled }

public enum InvoiceStatus { Draft, Issued, Paid, Cancelled }

public enum DisputeStatus { Open, Resolved, Rejected }

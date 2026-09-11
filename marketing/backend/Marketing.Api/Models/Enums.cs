namespace Marketing.Api.Models;

public enum UserRole
{
    Admin,
    Executive,
}

/// <summary>Where a lead sits in the sales pipeline.</summary>
public enum LeadStatus
{
    New,
    FollowUp,
    Negotiation,
    Converted,
    Lost,
}

/// <summary>What kind of touch-point an activity records.</summary>
public enum ActivityType
{
    Visit,
    Call,
    WhatsApp,
    Meeting,
    Note,
    StatusChange,
    Assignment,
}

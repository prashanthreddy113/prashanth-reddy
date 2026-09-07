using WaterTanker.Api.Models;

namespace WaterTanker.Api.Dtos;

public record OperatorRequest(string Name, string? Phone, string? Gstin, string? Address, decimal RatePerKl, bool IsActive = true);

public record OperatorDto(int Id, string Name, string? Phone, string? Gstin, string? Address, decimal RatePerKl, bool IsActive, int Tankers, int Devices)
{
    public static OperatorDto From(Operator o) => new(o.Id, o.Name, o.Phone, o.Gstin, o.Address, o.RatePerKl, o.IsActive, o.Tankers.Count, o.Devices.Count);
}

public record CommunityRequest(
    string Name, string Area, string? Address, string? ContactName, string? ContactPhone, int? Flats,
    double Latitude, double Longitude, int GeofenceRadiusM, decimal? RatePerKl, int? PreferredOperatorId,
    decimal SubscriptionPerMonth, bool IsActive = true);

public record CommunityDto(
    int Id, string Name, string Area, string? Address, string? ContactName, string? ContactPhone, int? Flats,
    double Latitude, double Longitude, int GeofenceRadiusM, decimal? RatePerKl, int? PreferredOperatorId, string? PreferredOperatorName,
    decimal SubscriptionPerMonth, bool IsActive)
{
    public static CommunityDto From(Community c) => new(
        c.Id, c.Name, c.Area, c.Address, c.ContactName, c.ContactPhone, c.Flats,
        c.Latitude, c.Longitude, c.GeofenceRadiusM, c.RatePerKl, c.PreferredOperatorId, c.PreferredOperator?.Name,
        c.SubscriptionPerMonth, c.IsActive);
}

public record UserRequest(string Email, string? Password, string DisplayName, string? Phone, UserRole Role, int? OperatorId, int? CommunityId, bool IsActive = true);

public record UserDto(int Id, string Email, string DisplayName, string? Phone, string Role, int? OperatorId, string? OperatorName, int? CommunityId, string? CommunityName, bool IsActive)
{
    public static UserDto From(User u) => new(u.Id, u.Email, u.DisplayName, u.Phone, u.Role.ToString(), u.OperatorId, u.Operator?.Name, u.CommunityId, u.Community?.Name, u.IsActive);
}

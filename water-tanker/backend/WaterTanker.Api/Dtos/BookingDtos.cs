using WaterTanker.Api.Models;

namespace WaterTanker.Api.Dtos;

public record BookingRequest(int? OperatorId, int RequestedLitres, int Loads, DateTime ScheduledFor, string? Notes);
public record BookingAcceptRequest(int? TankerId, decimal? RatePerKl);

public record BookingDto(
    int Id, int CommunityId, string? CommunityName, string? CommunityArea, int OperatorId, string? OperatorName,
    int RequestedLitres, int Loads, DateTime ScheduledFor, string Status, decimal RatePerKl,
    int? TankerId, string? TankerRegistration, string? Notes, DateTime CreatedAt, int DeliveryCount, decimal DeliveredLitres)
{
    public static BookingDto From(Booking b) => new(
        b.Id, b.CommunityId, b.Community?.Name, b.Community?.Area, b.OperatorId, b.Operator?.Name,
        b.RequestedLitres, b.Loads, b.ScheduledFor, b.Status.ToString(), b.RatePerKl,
        b.TankerId, b.Tanker?.RegistrationNumber, b.Notes, b.CreatedAt,
        b.Deliveries.Count, b.Deliveries.Sum(d => d.LitresDelivered));
}

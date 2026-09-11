using System.ComponentModel.DataAnnotations;

namespace Marketing.Api.Dtos;

public record ProjectDto(
    int Id, string Name, string? Description, string Color, int? TargetLeads, bool IsActive, DateTime CreatedAt,
    int LeadCount, int ConvertedCount, int HotCount, int ExecutiveCount, decimal PipelineValue, decimal WonValue,
    List<ProjectMemberDto> Executives);

public record ProjectMemberDto(int Id, string DisplayName, bool IsActive);

public record SaveProjectRequest(
    [Required, MaxLength(120)] string Name,
    string? Description,
    string? Color,
    int? TargetLeads,
    bool? IsActive,
    List<int>? ExecutiveIds);

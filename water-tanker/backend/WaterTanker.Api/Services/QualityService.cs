using WaterTanker.Api.Models;

namespace WaterTanker.Api.Services;

/// <summary>
/// Grades water against IS 10500:2012 limits. TDS: 500 mg/L acceptable, 2000 permissible.
/// Turbidity: 1 NTU acceptable, 5 permissible. Thresholds are configurable under "Quality".
/// </summary>
public class QualityService
{
    public double TdsGoodMax { get; }
    public double TdsAcceptableMax { get; }
    public double TurbidityGoodMax { get; }
    public double TurbidityAcceptableMax { get; }

    public QualityService(IConfiguration config)
    {
        TdsGoodMax = config.GetValue("Quality:TdsGoodMax", 500.0);
        TdsAcceptableMax = config.GetValue("Quality:TdsAcceptableMax", 2000.0);
        TurbidityGoodMax = config.GetValue("Quality:TurbidityGoodMax", 1.0);
        TurbidityAcceptableMax = config.GetValue("Quality:TurbidityAcceptableMax", 5.0);
    }

    public QualityGrade Grade(double? avgTds, double? avgTurbidity)
    {
        if (avgTds is null && avgTurbidity is null) return QualityGrade.Unknown;

        var tds = avgTds is double t
            ? (t <= TdsGoodMax ? QualityGrade.Good : t <= TdsAcceptableMax ? QualityGrade.Acceptable : QualityGrade.Poor)
            : QualityGrade.Good;
        var ntu = avgTurbidity is double n
            ? (n <= TurbidityGoodMax ? QualityGrade.Good : n <= TurbidityAcceptableMax ? QualityGrade.Acceptable : QualityGrade.Poor)
            : QualityGrade.Good;

        // The worse of the two decides.
        return (QualityGrade)Math.Max((int)tds, (int)ntu);
    }
}

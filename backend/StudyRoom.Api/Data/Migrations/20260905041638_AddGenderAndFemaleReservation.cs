using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyRoom.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGenderAndFemaleReservation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Students",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FemaleReservationPercent",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "FemaleReservationPercent",
                table: "Settings");
        }
    }
}

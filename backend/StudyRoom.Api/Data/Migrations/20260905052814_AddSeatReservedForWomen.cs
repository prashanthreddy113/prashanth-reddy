using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyRoom.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSeatReservedForWomen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ReservedForWomen",
                table: "Seats",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReservedForWomen",
                table: "Seats");
        }
    }
}

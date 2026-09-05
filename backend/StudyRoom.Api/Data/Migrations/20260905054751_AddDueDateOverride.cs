using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyRoom.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDueDateOverride : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDateOverride",
                table: "Students",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDateOverride",
                table: "Students");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yukktha.Api.Migrations
{
    /// <inheritdoc />
    public partial class BillingPaymentMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PaymentMethodAttached",
                table: "Stores",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubscriptionStartedAt",
                table: "Stores",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentMethodAttached",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "SubscriptionStartedAt",
                table: "Stores");
        }
    }
}

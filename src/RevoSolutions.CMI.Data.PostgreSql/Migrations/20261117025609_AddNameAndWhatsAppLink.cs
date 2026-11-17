using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RevoSolutions.CMI.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class AddNameAndWhatsAppLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LinkCode",
                table: "Contacts",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "LinkedAt",
                table: "Contacts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StoppedAt",
                table: "Contacts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatsAppNumber",
                table: "Contacts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Accounts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_LinkCode",
                table: "Contacts",
                column: "LinkCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Contacts_WhatsAppNumber",
                table: "Contacts",
                column: "WhatsAppNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Contacts_LinkCode",
                table: "Contacts");

            migrationBuilder.DropIndex(
                name: "IX_Contacts_WhatsAppNumber",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "LinkCode",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "LinkedAt",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "StoppedAt",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "WhatsAppNumber",
                table: "Contacts");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Accounts");
        }
    }
}

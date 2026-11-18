using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RevoSolutions.CMI.Data.PostgreSql.Migrations
{
    /// <inheritdoc />
    public partial class AddSosLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "Notices",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "Notices",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "Notices");
        }
    }
}

using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace mame_ao_server
{
	public class TOSEC : ISystem
	{
		public Server Server;

		private SqlConnection Connection;

		private DataRow MetaDataRow;

		public TOSEC(Server server)
		{
			Server = server;

			Connection = new SqlConnection($"{Server._ServerConnectionString}Initial Catalog=TOSEC-AO;");

			MetaDataRow = Database.ExecuteFill(Connection, "SELECT * FROM [_metadata]").Tables[0].Rows[0];

		}

		public void Process(Server.Context context)
		{
			context.InfoHeader = (string)MetaDataRow["info"];

			string payloadType = ExtentionToPayloadType(context.Extention);

			if (context.PathParts.Length == 1)
			{

				string html;
				using (SqlConnection connection = new SqlConnection($"{Server._ServerConnectionString}Initial Catalog=TOSEC-AO;"))
				{
					DataTable table = Database.ExecuteFill(connection, "SELECT [html] FROM [tosec_payload]").Tables[0];

					html = (string)table.Rows[0]["html"];
				}

				Server.WriteTempate("master", "<title>Spludlow Data - TOSEC</title>", "Spludlow Data - TOSEC",
					html, context);
				return;
			}

			if (context.PathParts.Length == 2)
			{
				string descriptionEnc = context.PathParts[1];
				string description = Uri.UnescapeDataString(descriptionEnc);

				string html = "";
				using (SqlConnection connection = new SqlConnection($"{Server._ServerConnectionString}Initial Catalog=TOSEC-AO;"))
				{
					SqlCommand command = new SqlCommand("SELECT [html] FROM [datafile_payload] WHERE ([datafile_key] = @datafile_key)", connection);
					command.Parameters.AddWithValue("@datafile_key", descriptionEnc);

					DataTable table = Database.ExecuteFill(command).Tables[0];

					html = (string)table.Rows[0]["html"];

				}
				Server.WriteTempate("master", $"<title>{description} - TOSEC Datafile</title>", $"{description} - TOSEC Datafile",
					html, context);

				return;

			}

			if (context.PathParts.Length == 3)
			{
				string datafile_key = context.PathParts[1];
				string game_key = context.PathParts[2];

				DataRow row = null;

				using (SqlConnection connection = new SqlConnection($"{Server._ServerConnectionString}Initial Catalog=TOSEC-AO;"))
				{
					SqlCommand command = new SqlCommand("SELECT [title], [html] FROM [game_payload] WHERE ([datafile_key] = @datafile_key AND [game_key] = @game_key)", connection);
					command.Parameters.AddWithValue("@datafile_key", datafile_key);
					command.Parameters.AddWithValue("@game_key", game_key);

					row = Database.ExecuteFill(command).Tables[0].Rows[0];
				}

				string title = (string)row["title"];
				string html = (string)row["html"];

				Server.WriteTempate("master", $"<title>{title}</title>", title, html, context);

				return;
			}

			ApplicationException exception = new ApplicationException($"TOSEC Route not found: '{context.Path}'");
			exception.Data.Add("status", 404);
			throw exception;
		}

		private List<string> ValidExtentions = new List<string>(new string[] { "", ".html", ".json", ".xml" });

		private string ExtentionToPayloadType(string extention)
		{
			if (ValidExtentions.Contains(extention) == false)
				throw new ApplicationException($"Bad extention {extention}");

			if (extention == "")
				extention = ".html";

			return extention.Substring(1);
		}


	}
}

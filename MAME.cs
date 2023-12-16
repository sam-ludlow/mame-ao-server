using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static mame_ao_server.Server;

namespace mame_ao_server
{
	public class MAME : ISystem
	{
		public Server Server;
		public MAME(Server server)
		{
			Server = server;
		}

		public void Process(Server.Context context)
		{
			if (context.PathParts.Length == 1)
			{
				Server.WriteTempate("master", "<title>Spludlow Data - mame</title>", "Spludlow Data - mame",
					"<h2>mame data subsets</h2><ul><li><a href=\"/mame/machine\">machine</a></li><li><a href=\"/mame/software\">software</a></li></ul>", context);
				return;
			}

			string dataSubSet = context.PathParts[1];

			if (context.Path.StartsWith("/mame/machine") == true || context.Path.StartsWith("/mame/software") == true)
				context.InfoHeader = (string)Server._Database._MetaData[context.PathParts[1]]["info"];

			if (context.PathParts.Length == 2)
			{
				switch (dataSubSet)
				{
					case "machine":
						Server.WriteTempate("master", "<title>Spludlow Data - mame machine</title>", "Spludlow Data - mame machine",
"<p>this page is not ready, but you can access the data pages using the address bar, for example:</p><ul><li><a href=\"/mame/machine/mrdo\">/mame/machine/mrdo</a></li><li><a href=\"/mame/machine/bbcb\">/mame/machine/bbcb</a></li></ul>", context);
						break;

					case "software":
						MameSoftwareLists(context);
						break;

					default:
						throw new ApplicationException($"mame sub set not found: {dataSubSet}");
				}
				return;
			}

			if (context.Path.StartsWith("/mame/machine/") == true && context.PathParts.Length == 3)
			{
				MameMachine(context);
				return;
			}

			if (context.Path.StartsWith("/mame/software/") == true && context.PathParts.Length == 3)
			{
				MameSoftwareList(context);
				return;
			}

			if (context.Path.StartsWith("/mame/software/") == true && context.PathParts.Length == 4)
			{
				MameSoftware(context);
				return;
			}

			ApplicationException exception = new ApplicationException($"MAME Route not found: '{context.Path}'");
			exception.Data.Add("status", 404);
			throw exception;

		}

		public void MameMachine(Context context)
		{
			string machine_name = context.PathParts[2];

			if (context.Extention != "")
				machine_name = machine_name.Substring(0, machine_name.Length - context.Extention.Length);

			string[] payloadParts = Server._Database.PayloadMachine(machine_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				Server.WriteTempate("master", $"<title>{title}</title>", title, payload, context);
			else
				context.Writer.WriteLine(payload);
		}

		public void MameSoftware(Context context)
		{
			string softwarelist_name = context.PathParts[2];
			string software_name = context.PathParts[3];

			if (context.Extention != "")
				software_name = software_name.Substring(0, software_name.Length - context.Extention.Length);

			string[] payloadParts = Server._Database.PayloadSoftware(softwarelist_name, software_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				Server.WriteTempate("master", $"<title>{title}</title>", title, payload, context);
			else
				context.Writer.WriteLine(payload);
		}
		public void MameSoftwareList(Context context)
		{
			string softwarelist_name = context.PathParts[2];

			if (context.Extention != "")
				softwarelist_name = softwarelist_name.Substring(0, softwarelist_name.Length - context.Extention.Length);

			string[] payloadParts = Server._Database.PayloadSoftwareList(softwarelist_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				Server.WriteTempate("master", $"<title>{title}</title>", title, payload, context);
			else
				context.Writer.WriteLine(payload);

		}

		public void MameSoftwareLists(Context context)
		{
			string[] payloadParts = Server._Database.PayloadSoftwareLists(context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				Server.WriteTempate("master", $"<title>{title}</title>", title, payload, context);
			else
				context.Writer.WriteLine(payload);
		}
	}
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace mame_ao_server
{
	public class TOSEC : ISystem
	{
		public Server Server;
		public TOSEC(Server server)
		{
			Server = server;
		}

		public void Process(Server.Context context)
		{
			if (context.PathParts.Length == 1)
			{
				Server.WriteTempate("master", "<title>Spludlow Data - TOSEC</title>", "Spludlow Data - TOSEC",
					"Coming soon...", context);
				return;
			}

			ApplicationException exception = new ApplicationException($"TOSEC Route not found: '{context.Path}'");
			exception.Data.Add("status", 404);
			throw exception;
		}
	}
}

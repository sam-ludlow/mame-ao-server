using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;

namespace updater
{
	internal class Program
	{
		static void Main(string[] args)
		{
			if (args.Length != 1)
				throw new ApplicationException("Usage updater.exe <config filename>");

			string configFilename = args[0];

			if (File.Exists(configFilename) == false)
				throw new ApplicationException($"config file does not exist: {configFilename}");

			Dictionary<string, string> config = new Dictionary<string, string>();

			using (StreamReader reader = new StreamReader(configFilename))
			{
				string line;
				while ((line = reader.ReadLine()) != null)
				{
					line = line.Trim();
					if (line.Length == 0 || line[0] == '#')
						continue;

					string[] parts = line.Split(new char[] { '\t' }, StringSplitOptions.RemoveEmptyEntries);
					if (parts.Length != 2)
						throw new ApplicationException($"Bad config line, expected 2 parts tab delimited: {line}");

					config.Add(parts[0].Trim(), parts[1].Trim());
				}
			}

			string accessLinkerPath = config["accessLinkerPath"];
			string backupDirectory = config["backupDirectory"];
			string[] cores = config["cores"].Split(',').Select(core => core.Trim()).ToArray();
			string databasePrepare = config["databasePrepare"];
			string mameAoPath = config["mameAoPath"];
			string rootDirectory = config["rootDirectory"];
			string databaseServer = config["databaseServer"];
			string startUrl = config["startUrl"];
			string stopUrl = config["stopUrl"];

			Dictionary<string, string[]> coresDatabases = new Dictionary<string, string[]>()
			{
				{ "mame", new string[] { "ao-mame-machine", "ao-mame-software" } },
				{ "hbmame", new string[] { "ao-hbmame-machine", "ao-hbmame-software" } },
				{ "fbneo", new string[] { "ao-fbneo" } },
				{ "tosec", new string[] { "ao-tosec" } },
			};

			foreach (string core in cores)
			{
				try
				{
					Console.WriteLine($"{core} START.");

					string directory = Path.Combine(rootDirectory, core);

					if (Run(mameAoPath, $"{core}-get directory=\"{directory}\"") == 0)
					{
						Console.WriteLine($"{core} nothing to do.");
					}
					else
					{
						Console.WriteLine($"{core} processing.");

						Run(mameAoPath, $"{core}-xml directory=\"{directory}\"");

						foreach (string databaseName in coresDatabases[core])
							Run(accessLinkerPath, $"mssql-delete mssql=\"{databaseServer}\" name=\"{databaseName}-temp\"");

						string databaseNames = String.Join(", ", coresDatabases[core].Select(name => $"{name}-temp"));

						Run(mameAoPath, $"{core}-mssql directory=\"{directory}\" server=\"{databaseServer}\" names=\"{databaseNames}\"");
						Run(mameAoPath, $"{core}-mssql-payload directory=\"{directory}\" server=\"{databaseServer}\" names=\"{databaseNames}\"");
						Run(mameAoPath, $"{core}-mssql-payload-html directory=\"{directory}\" server=\"{databaseServer}\" names=\"{databaseNames}\"");

						foreach (string databaseName in coresDatabases[core])
						{
							string databaseNameTemp = $"{databaseName}-temp";
							string backupFilename = Path.Combine(backupDirectory, $"{databaseNameTemp}.bak");

							Sql($"{databaseServer}Database={databaseNameTemp};", databasePrepare);

							File.Delete(backupFilename);
							Run(accessLinkerPath, $"mssql-backup filename=\"{backupFilename}\" mssql=\"{databaseServer}\" name=\"{databaseNameTemp}\"");
						}

						Get(stopUrl);

						try
						{
							foreach (string databaseName in coresDatabases[core])
							{
								string databaseNameTemp = $"{databaseName}-temp";
								string backupFilename = Path.Combine(backupDirectory, $"{databaseNameTemp}.bak");

								Run(accessLinkerPath, $"mssql-delete mssql=\"{databaseServer}\" name=\"{databaseName}\"");
								Run(accessLinkerPath, $"mssql-restore filename=\"{backupFilename}\" mssql=\"{databaseServer}\" name=\"{databaseName}\"");

								File.Delete(backupFilename);
								Run(accessLinkerPath, $"mssql-delete mssql=\"{databaseServer}\" name=\"{databaseNameTemp}\"");
							}
						}
						finally
						{
							Get(startUrl);
						}
					}

					Console.WriteLine($"{core} FINISH.");
				}
				catch (Exception e)
				{
					Console.WriteLine($"{core} ERROR, {e.Message}");
					Console.WriteLine(e.ToString());
				}
			}
		}

		public static int Run(string fileName, string arguments)
		{
			ProcessStartInfo info = new ProcessStartInfo()
			{
				Arguments = arguments,
				FileName = fileName,
				UseShellExecute = false,
			};

			using (Process process = Process.Start(info))
			{
				process.WaitForExit();

				if (process.ExitCode != 0 && process.ExitCode != 1)
					throw new ApplicationException($"Bad exit code: {process.ExitCode}");

				return process.ExitCode;
			}
		}

		public static void Sql(string connectionString, string commandText)
		{
			using (SqlConnection connection = new SqlConnection(connectionString))
			{
				using (SqlCommand command = new SqlCommand(commandText, connection))
				{
					connection.Open();
					try
					{
						command.ExecuteNonQuery();
					}
					finally
					{
						connection.Close();
					}
				}
			}
		}

		public static void Get(string url)
		{
			HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
			request.Method = "GET";

			using (WebResponse response = request.GetResponse())
			{

			}
		}
	}
}

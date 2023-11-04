using mame_ao_server;

Dictionary<string, string> parameters = new Dictionary<string, string>();

foreach (string arg in args)
{
	int index = arg.IndexOf('=');
	if (index == -1)
		throw new ApplicationException("Bad argument, expecting KEY=VALUE, " + arg);

	parameters.Add(arg.Substring(0, index).ToUpper(), arg.Substring(index + 1));
}

if (parameters.ContainsKey("DIRECTORY") == false)
	parameters.Add("DIRECTORY", Environment.CurrentDirectory);


Server server = new(parameters["BINDING"], parameters["DIRECTORY"]);
server.Start(parameters["MSSQL_SERVER"], parameters["MSSQL_TARGET_NAMES"]);

Console.WriteLine("Listener started. any key to exit.");

Console.ReadKey();

Console.WriteLine("Stopping");

server.Stop();

Console.WriteLine("EXIT");

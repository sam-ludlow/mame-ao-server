

using mame_ao_server;

Server server = new();

server.Start();

Console.WriteLine("Listener started. any key to exit.");

Console.ReadKey();

Console.WriteLine("Stopping");

server.Stop();

Console.WriteLine("EXIT");
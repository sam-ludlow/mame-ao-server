using System.IO;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using static mame_ao_server.Server;

namespace mame_ao_server
{
	public interface ISystem
	{
		public void Process(Context context);
	}

	public class Server
	{
		private bool _keepOnRunning = true;

		private HttpListener _HttpListener;

		private Task? _ListenTask = null;

		public string _ServerConnectionString;

		public Database? _Database;

		private string? _Directory;

		private Dictionary<string, string[]> _HtmlTemplates = new Dictionary<string, string[]>();

		private Dictionary<string, byte[]> _WebAssets = new Dictionary<string, byte[]>();

		private Dictionary<string, string> _MimeTypes = new Dictionary<string, string>() {
			{ "",		"text/html; charset=utf-8" },
			{ ".html",  "text/html; charset=utf-8" },
			{ ".xml",   "text/xml; charset=utf-8" },
			{ ".json",  "application/json; charset=utf-8" },
			{ ".css",   "text/css; charset=utf-8" },
			{ ".svg",   "image/svg+xml; charset=utf-8" },
			{ ".ico",   "image/x-icon" },
		};

		private Dictionary<string, string> _Menu = new Dictionary<string, string>() {

			{	"/mame",	"MAME" },
			{   "/tosec",    "TOSEC" },
		};

		public class Context
		{
			public HttpListenerContext HttpContext;
			public StreamWriter Writer;

			public string Path;
			public string[] PathParts;
			public string Extention;

			public string NavHtml = "";
			public string InfoHeader = "";

			public Context(HttpListenerContext httpContext, StreamWriter writer)
			{
				HttpContext = httpContext;
				Writer = writer;

				Path = httpContext.Request.Url.AbsolutePath.ToLower();
				PathParts = Path.Split(new char[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
				Extention = System.IO.Path.GetExtension(Path);

				if (Extention.Length > 5)
					Extention = "";

				NavHtml = "<table><tr><td> <a href=\"/mame\">MAME</a> </td><td> <a href=\"/tosec\">TOSEC</a> </td></tr></table>";

			}
		}

		public Server(string binding, string directory)
		{
			_HttpListener = new ();
			_HttpListener.Prefixes.Add(binding);

			_Directory = directory;

			foreach (string filename in  Directory.GetFiles(Path.Combine(_Directory, "html")))
			{
				if (filename.EndsWith(".html") == true)
					continue;

				_WebAssets.Add("/" + Path.GetFileName(filename), File.ReadAllBytes(filename));
			}

			LoadHtmlTemplates();

		}

		public void LoadHtmlTemplates()
		{
			string filename = Path.Combine(_Directory, "html", "master.html");
			string name = Path.GetFileNameWithoutExtension(filename);

			string[] tags = new string[] { "@HEAD@", "@NAV@", "@INFO@", "@BODY@" };

			string[] parts = new string[tags.Length + 1];

			StringBuilder current = new StringBuilder();
			foreach (string line in File.ReadAllLines(filename, Encoding.UTF8))
			{
				int index;
				for (index = 0; index < tags.Length; ++index)
				{
					if (line.Contains(tags[index]) == true)
					{
						parts[index] = current.ToString();
						current.Length = 0;
						index = -1;
						break;
					}
				}

				if (index != -1)
					current.AppendLine(line);
			}
			parts[parts.Length - 1] = current.ToString();

			_HtmlTemplates.Add(name, parts);

		}

		public void Start(string serverConnectionString, string databaseNames)
		{
			_ServerConnectionString = serverConnectionString;

			_Database = new Database(serverConnectionString, databaseNames);
			_Database.Initialize();


			Dictionary<string, ISystem> systems = new Dictionary<string, ISystem>() {
				{ "mame", new MAME(this) },
				{ "tosec", new TOSEC(this) }
			};


			_HttpListener.Start();

			_ListenTask = new Task(() =>
			{
			while (_keepOnRunning == true)
			{
				HttpListenerContext httpContext = _HttpListener.GetContext();

				using (StreamWriter writer = new StreamWriter(httpContext.Response.OutputStream, new UTF8Encoding(false)))
				{
					try
					{
						Context context = new Context(httpContext, writer);

						Console.WriteLine($"'{context.Path}' {context.PathParts.Length} : '{String.Join(", ", context.PathParts)}'");

						if (_MimeTypes.ContainsKey(context.Extention) == false)
							throw new ApplicationException($"MIME mapping not found: '{context.Extention}'");

						httpContext.Response.Headers.Add("content-type", _MimeTypes[context.Extention]);

						httpContext.Response.Headers.Add("access-control-allow-origin", "*");
						httpContext.Response.Headers.Add("x-content-type-options", "nosniff");
						httpContext.Response.Headers.Add("cache-control", "public");


						if (httpContext.Request.HttpMethod == "OPTIONS")
						{
							httpContext.Response.Headers.Add("Allow", "OPTIONS, GET");
						}
						else
						{

							switch (context.Path)
							{
								case "/favicon.ico":
								case "/stylesheet.css":
								case "/spludlow.svg":
									httpContext.Response.OutputStream.Write(_WebAssets[context.Path], 0, _WebAssets[context.Path].Length);
									break;

								case "/":
									WriteTempate("master", "<title>Spludlow Data</title>", "Spludlow Data",
										"<h2>Welcome to Spludlow Data</h2><p>Retro computer hardware & software reference web</p>" +
										"<ul><li><a href=\"/mame\">MAME</a></li><li><a href=\"/tosec\">TOSEC</a></li></ul>" +
										"<p><a href=\"https://github.com/sam-ludlow/mame-ao-server\" target=\"_blank\">This web is open source</a></p>", context);
									break;


								default:

									string systemName = context.PathParts[0];

									if (systems.Keys.Contains(systemName) == true)
									{
										ISystem system = systems[systemName];
										system.Process(context);
										break;
									}

									ApplicationException exception = new ApplicationException($"Route not found: '{context.Path}'");
									exception.Data.Add("status", 404);
									throw exception;
								}
							}

						}
						catch (Exception e)
						{
							if (e is TargetInvocationException && e.InnerException != null)
								e = e.InnerException;

							Console.WriteLine(e.ToString());

							ErrorResponse(httpContext, writer, e);
						}
					}
				}
			});

			_ListenTask.Start();

		}




		public void WriteTempate(string templateName, string head, string title, string body, Context context)
		{
			string[] parts = _HtmlTemplates[templateName];

			context.Writer.WriteLine(parts[0]);
			context.Writer.WriteLine(head);
			context.Writer.WriteLine(parts[1].Replace("@H1@", title));
			context.Writer.WriteLine(context.NavHtml);
			context.Writer.WriteLine(parts[2]);
			context.Writer.WriteLine(context.InfoHeader);
			context.Writer.WriteLine(parts[3]);
			context.Writer.WriteLine(body);
			context.Writer.WriteLine(parts[4]);
		}

		public void Stop()
		{
			_keepOnRunning = false;

			//_ListenTask.Wait();	// !!!! needs a request

			_HttpListener.Close();

		}


		private void ErrorResponse(HttpListenerContext context, StreamWriter writer, Exception e)
		{
			int status = 500;

			if (e is ApplicationException)
				status = 400;

			if (e.Data["status"] != null)
				status = (int)e.Data["status"];

			context.Response.StatusCode = status;

			//dynamic json = new JObject();

			//json.status = status;
			//json.message = e.Message;
			//json.error = e.ToString();

			writer.WriteLine(e.Message);	// json.ToString(Formatting.Indented));
		}

	}
}

using System.IO;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using static mame_ao_server.Server;

namespace mame_ao_server
{
	public class Server
	{
		private bool _keepOnRunning = true;

		private HttpListener _HttpListener;

		private Task? _ListenTask = null;

		private Database? _Database;

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

		public class Context
		{
			public HttpListenerContext HttpContext;
			public StreamWriter Writer;

			public string Path;
			public string[] PathParts;
			public string Extention;

			public Context(HttpListenerContext httpContext, StreamWriter writer)
			{
				HttpContext = httpContext;
				Writer = writer;

				Path = httpContext.Request.Url.AbsolutePath.ToLower();
				PathParts = Path.Split(new char[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
				Extention = System.IO.Path.GetExtension(Path);
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

			string[] parts = new string[3];

			string[] tags = new string[] { "@HEAD@", "@BODY@" };

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
			_Database = new Database(serverConnectionString, databaseNames);
			_Database.Initialize();


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
								//byte[] data;

								switch (context.Path)
								{
									case "/favicon.ico":
									case "/stylesheet.css":
									case "/spludlow.svg":
										httpContext.Response.OutputStream.Write(_WebAssets[context.Path], 0, _WebAssets[context.Path].Length);
										break;

									case "/":
										WriteTempate("master", "<title>Spludlow Data</title>", "Spludlow Data",
											"<h2>Welcome to Spludlow Data</h2><p><a href=\"https://github.com/sam-ludlow/mame-ao-server\" target=\"_blank\">Retro computer hardware & software reference web - look at the code</a></p><ul><li><a href=\"/mame\">mame</a></li><li>more...</li></ul>", writer);
										break;

									case "/mame":
										WriteTempate("master", "<title>Spludlow Data - mame</title>", "Spludlow Data - mame",
											"<h2>mame data subsets</h2><ul><li><a href=\"/mame/machine\">machine</a></li><li><a href=\"/mame/software\">software</a></li></ul>", writer);
										break;

									case "/mame/machine":
										WriteTempate("master", "<title>Spludlow Data - mame machine</title>", "Spludlow Data - mame machine",
	"<p>this page is not ready, but you can access the data pages using the address bar, for example:</p><ul><li><a href=\"/mame/machine/mrdo\">/mame/machine/mrdo</a></li><li><a href=\"/mame/machine/bbcb\">/mame/machine/bbcb</a></li></ul>", writer);
										break;

									case "/mame/software":
										WriteTempate("master", "<title>Spludlow Data - mame software</title>", "Spludlow Data - mame software",
	"<p>this page is not ready, but you can access the data pages using the address bar, for example</p><ul><li><a href=\"/mame/software/neogeo\">/mame/software/neogeo</a></li><li><a href=\"/mame/software/cdi/aidsawar\">/mame/software/cdi/aidsawar</a></li></ul>", writer);
										break;

									default:

										if (context.Path.StartsWith("/mame/machine/") == true && context.PathParts.Length == 3)
										{
											MameMachine(context);
											break;
										}

										if (context.Path.StartsWith("/mame/software/") == true && context.PathParts.Length == 3)
										{
											MameSoftwareList(context);
											break;
										}

										if (context.Path.StartsWith("/mame/software/") == true && context.PathParts.Length == 4)
										{
											MameSoftware(context);
											break;
										}


										ApplicationException exception = new ApplicationException($"Route not found: '{context.Path}'");
										exception.Data.Add("status", 404);
										throw exception;


										//MethodInfo method = GetType().GetMethod(path.Replace("/", "_"));

										//if (method == null)
										//{
										//	ApplicationException exception = new ApplicationException($"Not found: {path}");
										//	exception.Data.Add("status", 404);
										//	throw exception;
										//}

										//method.Invoke(this, new object[] { context, writer });

										//break;
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

		public void MameMachine(Context context)
		{
			string machine_name = context.PathParts[2];

			if (context.Extention != "")
				machine_name = machine_name.Substring(0, machine_name.Length - context.Extention.Length);

			string[] payloadParts = _Database.PayloadMachine(machine_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				WriteTempate("master", $"<title>{title}</title>", title, payload, context.Writer);
			else
				context.Writer.WriteLine(payload);
		}

		public void MameSoftware(Context context)
		{
			string softwarelist_name = context.PathParts[2];
			string software_name = context.PathParts[3];

			if (context.Extention != "")
				software_name = software_name.Substring(0, software_name.Length - context.Extention.Length);

			string[] payloadParts = _Database.PayloadSoftware(softwarelist_name, software_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				WriteTempate("master", $"<title>{title}</title>", title, payload, context.Writer);
			else
				context.Writer.WriteLine(payload);
		}
		public void MameSoftwareList(Context context)
		{
			string softwarelist_name = context.PathParts[2];

			if (context.Extention != "")
				softwarelist_name = softwarelist_name.Substring(0, softwarelist_name.Length - context.Extention.Length);

			string[] payloadParts = _Database.PayloadSoftwareList(softwarelist_name, context.Extention);

			string title = payloadParts[0];
			string payload = payloadParts[1];

			//	TODO headers & metadata

			if (context.Extention == "")
				WriteTempate("master", $"<title>{title}</title>", title, payload, context.Writer);
			else
				context.Writer.WriteLine(payload);

		}


		public void WriteTempate(string templateName, string head, string title, string body, StreamWriter writer)
		{
			string[] parts = _HtmlTemplates[templateName];

			writer.WriteLine(parts[0]);
			writer.WriteLine(head);

			//	server head

			writer.WriteLine(parts[1].Replace("@H1@", title));
			writer.WriteLine(body);
			writer.WriteLine(parts[2]);
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

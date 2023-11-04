using System.Net;
using System.Reflection;
using System.Text;

namespace mame_ao_server
{
	public class Server
	{
		private bool _keepRunning = true;

		private HttpListener _HttpListener;

		private Task? _ListenTask = null;

		private Database? _Database;

		private string? _Directory;

		private Dictionary<string, string> _HtmlTemplates = new Dictionary<string, string>();

		public Server(string binding, string directory)
		{
			_HttpListener = new ();
			_HttpListener.Prefixes.Add(binding);

			_Directory = directory;

			_HtmlTemplates.Add("mame_machine", File.ReadAllText(Path.Combine(_Directory, "html", "mame_machine.html"), Encoding.UTF8));
		}

		public void Start(string serverConnectionString, string databaseNames)
		{
			_Database = new Database(serverConnectionString, databaseNames);
			_Database.Initialize();



			_HttpListener.Start();

			_ListenTask = new Task(() =>
			{
				while (_keepRunning == true)
				{
					HttpListenerContext context = _HttpListener.GetContext();

					context.Response.Headers.Add("Access-Control-Allow-Origin", "*");

					context.Response.Headers["Content-Type"] = "application/json; charset=utf-8";

					string path = context.Request.Url.AbsolutePath.ToLower();

					Console.WriteLine(path);

					using (StreamWriter writer = new StreamWriter(context.Response.OutputStream, new UTF8Encoding(false)))
					{
						try
						{
							if (context.Request.HttpMethod == "OPTIONS")
							{
								context.Response.Headers.Add("Allow", "OPTIONS, GET");
							}
							else
							{
								switch (path)
								{
									case "/favicon.ico":
										context.Response.Headers["Content-Type"] = "image/x-icon";
										context.Response.OutputStream.Write(_FavIcon, 0, _FavIcon.Length);
										break;

									default:

										if (path.StartsWith("/mame/machine/") == true)
										{

											MameMachine(context, writer);

										}
										else
										{
											ApplicationException exception = new ApplicationException($"Not found: '{path}'");
											exception.Data.Add("status", 404);
											throw exception;
										}


										//MethodInfo method = GetType().GetMethod(path.Replace("/", "_"));

										//if (method == null)
										//{
										//	ApplicationException exception = new ApplicationException($"Not found: {path}");
										//	exception.Data.Add("status", 404);
										//	throw exception;
										//}

										//method.Invoke(this, new object[] { context, writer });

										break;
								}
							}

						}
						catch (Exception e)
						{
							if (e is TargetInvocationException && e.InnerException != null)
								e = e.InnerException;

							ErrorResponse(context, writer, e);
						}
					}
				}
			});

			_ListenTask.Start();

		}

		public void MameMachine(HttpListenerContext context, StreamWriter writer)
		{
			string path = context.Request.Url.AbsolutePath.ToLower();
			string[] pathParts = path.Split(new char[] { '/' }, StringSplitOptions.RemoveEmptyEntries);

			string name = pathParts[2];
			string type = "html";

			int dotIndex = name.IndexOf('.');
			if (dotIndex != -1)
			{
				type = name.Substring(dotIndex + 1);
				name = name.Substring(0, dotIndex);
			}

			switch (type)
			{
				case "html":
					context.Response.Headers["Content-Type"] = "text/html; charset=utf-8";
					break;

				case "xml":
					context.Response.Headers["Content-Type"] = "text/xml; charset=utf-8";
					break;

				case "json":
					context.Response.Headers["Content-Type"] = "application/json; charset=utf-8";
					break;

				default:
					throw new ApplicationException($"Bad Machine Payload type '{type}'.");
			}

			string payload = _Database.PayloadMachine(name, type);

			if (type == "html")
				payload = _HtmlTemplates["mame_machine"].Replace("@BODY@", payload);

			writer.WriteLine(payload);
		}

		public void Stop()
		{
			_keepRunning = false;

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

		private byte[] _FavIcon = Convert.FromBase64String(@"
			AAABAAEAEBAAAAAAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAMAAAAAAAAAAAAAAAAA
			AAAAAAD0tgDzuQDzsgD2xgD99NT++OP++OX++OX/+OPA67QA6t3j6KL/9tr++OP9+OX9+OX0vQD0
			vgD99dj///T/75P/6m7/6mv/6Wz/4ne+3G4A7Obg2EL/3F7/3Vv/32v84nnysAD99+P/9MThrQCV
			aACCXQCCXQCgcgDyoQC9vwAA8PesvwCDyQB/ygDQswD/rQD0uwD//e/vsgBEMgAJDiUdGh8bGh8H
			DCZzTADEwwAA8/8A8/8A8/8A8/8A8fjBwwD+/PX/1gC+hgAUFiLCjQDvrQDysACgdgAsGgyxtQAA
			+P873pbetQDbtQAN5LcA79X//vv2uwDkogDQlwDoqADdoADlpwCRawAtGwuwtgAA9v7AvAD/qgD/
			qQCpwgAA+f/+/PXztQD9tQCqfQAgHBwUFiIWFiIFCid8UgDAwwAA8PfXtgD3rQD7rAC+vQAA9//+
			/PX4ugDYmwAbGR9cRgCZcQCRagCtfwD/swC9wQAA8PvUtwD5rQD8rAC9vQAA+P///fn+wgC2gwAX
			FyHqqgD/xAD/xADcnwB8UwCytwAA9/+MywD/qAD/qAB10ToA9////fX7zwDYmAAeGx5vVACgdgCi
			dwBRPgA2IQG5vAAA9v8A8f9z0URv0kkA9v9p2Vj76Jv977v7sgCQaQASEyITFCISEyIdGh+6fwDH
			xQAA7uwg4a4A8/8A9P9U12/7swDzuQD//fn1wAD2rgDbngDUmQDTmQDhowD6swDqsQDSuADyrwDX
			tgDVswD5sgD/7KDxrgD977/98MbzsAD3sAD4swD4swD2sgDyrwD0rgD5rQD0rwD3qQD5swD+8MD/
			/vPxrADysAD+/fX75Y7ysgDxqwDyrgDyrwDyrwDyrwDyrgDxqgDztQD977n99+D0swDyrwDxqwDz
			sgD//fn98sz0vwDyrgDxqwDxqgDxqwDyrwD1xQD9+OL+/PXysgD1rADyrwDyrwDxrQDztQD889D/
			/fn989P75pT53mj76J399dv//fn87rjzswDyrADxrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
			AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
		");

	}
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;

namespace mame_ao_server
{
	public class Server
	{
		private bool _keepRunning = true;

		private HttpListener _HttpListener;

		private Task? _ListenTask = null;

		Dictionary<string, Dictionary<string, XElement>> _Elements = new ();

		public Server()
		{
			_HttpListener = new ();
			_HttpListener.Prefixes.Add("http://localhost:8888/");
		}

		public void Start()
		{


			string xmlFilename = @"C:\DATA\0259\_machine.xml";

			Console.Write($"Loading XML {xmlFilename} ...");

			XElement element = XElement.Load(xmlFilename);

			Dictionary<string, XElement> set = new Dictionary<string, XElement>();

			foreach (XElement software in element.Descendants("machine"))
			{
				string key = software.Attribute("name").Value;

				//Console.WriteLine(key);

				set.Add(key, software);
			}
			

			_Elements.Add("software", set);

			Console.WriteLine("...done.");


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
										//context.Response.OutputStream.Write(_FavIcon, 0, _FavIcon.Length);
										break;

									default:


										MethodInfo method = GetType().GetMethod(path.Replace("/", "_"));

										if (method == null)
										{
											ApplicationException exception = new ApplicationException($"Not found: {path}");
											exception.Data.Add("status", 404);
											throw exception;
										}

										method.Invoke(this, new object[] { context, writer });

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

		public void _(HttpListenerContext context, StreamWriter writer)
		{
			Dictionary<string, XElement> set = _Elements["software"];


			string data = set["mrdo"].ToString();

			context.Response.Headers["Content-Type"] = "text/xml; charset=utf-8";

			writer.WriteLine(data);

			return;


			string html = File.ReadAllText(@"Schema.yaml", Encoding.UTF8);

			context.Response.Headers["Content-Type"] = "text/yaml; charset=utf-8";

			writer.WriteLine(html);
		}

		public void Stop()
		{
			_keepRunning = false;

			_ListenTask.Wait();	// !!!! needs a request

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

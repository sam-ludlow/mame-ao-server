using Microsoft.Data.SqlClient;
using System.Data;

namespace mame_ao_server
{
	public class Database
	{
		public SqlConnection _SqlConnectionMachine;
		public SqlConnection _SqlConnectionSoftware;

		DataTable _PayloadMachine;

		public Boolean _TestMode = true;

		public Dictionary<string, DataRow> _MetaData;

		public Database(string serverConnectionString, string databaseNames)
		{
			string[] databaseNamesEach = databaseNames.Split(new char[] { ',' });
			for (int index = 0; index < databaseNamesEach.Length; ++index)
				databaseNamesEach[index] = databaseNamesEach[index].Trim();

			if (databaseNamesEach.Length != 2)
				throw new ApplicationException($"Bad database names, should be 2 comma delimeted: '{databaseNames}'");

			_SqlConnectionMachine = new SqlConnection(serverConnectionString + $"Initial Catalog='{databaseNamesEach[0]}';");
			_SqlConnectionSoftware = new SqlConnection(serverConnectionString + $"Initial Catalog='{databaseNamesEach[1]}';");

		}

		public void Initialize()
		{
			DataSet dataSet;

			_MetaData = new Dictionary<string, DataRow>();

			dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter("SELECT * FROM [_metadata]", _SqlConnectionMachine))
				adapter.Fill(dataSet);
			_MetaData.Add("machine", dataSet.Tables[0].Rows[0]);

			dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter("SELECT * FROM [_metadata]", _SqlConnectionSoftware))
				adapter.Fill(dataSet);
			_MetaData.Add("software", dataSet.Tables[0].Rows[0]);


			if (_TestMode == true)
				return;



			dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter("SELECT * FROM [machine_payload]", _SqlConnectionMachine))
				adapter.Fill(dataSet);
			_PayloadMachine = dataSet.Tables[0];
			_PayloadMachine.TableName = "machine_payload";
			_PayloadMachine.PrimaryKey = new DataColumn[] { _PayloadMachine.Columns["machine_name"] };



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

		public string[] PayloadMachine(string machine_name, string extention)
		{
			string type = ExtentionToPayloadType(extention);

			DataRow row = null;

			if (_TestMode == true)
			{
				DataSet dataSet = new DataSet();
				using (SqlDataAdapter adapter = new SqlDataAdapter($"SELECT [title], [{type}] FROM [machine_payload] WHERE machine_name = @machine_name", _SqlConnectionMachine))
				{
					adapter.SelectCommand.Parameters.AddWithValue("@machine_name", machine_name);

					adapter.Fill(dataSet);
				}

				if (dataSet.Tables[0].Rows.Count > 0)
					row = dataSet.Tables[0].Rows[0];
			}
			else
			{
				row = _PayloadMachine.Rows.Find(machine_name);
			}


			if (row == null)
				throw new ApplicationException($"Machine not found: '{machine_name}'");

			return new string[] { (string)row["title"], (string)row[type] };
		}
		public string[] PayloadSoftware(string softwarelist_name, string software_name, string extention)
		{
			string type = ExtentionToPayloadType(extention);

			DataRow row = null;

			if (_TestMode == true)
			{
				DataSet dataSet = new DataSet();
				using (SqlDataAdapter adapter = new SqlDataAdapter($"SELECT [title], [{type}] FROM [software_payload] WHERE (softwarelist_name = @softwarelist_name AND software_name = @software_name)", _SqlConnectionSoftware))
				{
					adapter.SelectCommand.Parameters.AddWithValue("@softwarelist_name", softwarelist_name);
					adapter.SelectCommand.Parameters.AddWithValue("@software_name", software_name);

					adapter.Fill(dataSet);
				}

				if (dataSet.Tables[0].Rows.Count > 0)
					row = dataSet.Tables[0].Rows[0];
			}
			else
			{
				//row = _PayloadSoftware.Rows.Find(softwarelist_name, software_name);
			}


			if (row == null)
				throw new ApplicationException($"Software not found: '{softwarelist_name}', '{software_name}'");

			return new string[] { (string)row["title"], (string)row[type] };
		}

		public string[] PayloadSoftwareList(string softwarelist_name, string extention)
		{
			string type = ExtentionToPayloadType(extention);

			DataRow row = null;

			if (_TestMode == true)
			{
				DataSet dataSet = new DataSet();
				using (SqlDataAdapter adapter = new SqlDataAdapter($"SELECT [title], [{type}] FROM [softwarelist_payload] WHERE (softwarelist_name = @softwarelist_name)", _SqlConnectionSoftware))
				{
					adapter.SelectCommand.Parameters.AddWithValue("@softwarelist_name", softwarelist_name);

					adapter.Fill(dataSet);
				}

				if (dataSet.Tables[0].Rows.Count > 0)
					row = dataSet.Tables[0].Rows[0];
			}
			else
			{
				//row = _PayloadSoftware.Rows.Find(softwarelist_name, software_name);
			}


			if (row == null)
				throw new ApplicationException($"Software list not found: '{softwarelist_name}'");

			return new string[] { (string)row["title"], (string)row[type] };
		}

		public string[] PayloadSoftwareLists(string extention)
		{
			string type = ExtentionToPayloadType(extention);

			DataRow row = null;

			if (_TestMode == true)
			{
				DataSet dataSet = new DataSet();
				using (SqlDataAdapter adapter = new SqlDataAdapter($"SELECT [title], [{type}] FROM [softwarelists_payload] WHERE ([key_1] = '1')", _SqlConnectionSoftware))
				{
					adapter.Fill(dataSet);
				}

				if (dataSet.Tables[0].Rows.Count > 0)
					row = dataSet.Tables[0].Rows[0];
			}
			else
			{
				//row = _PayloadSoftware.Rows.Find(softwarelist_name, software_name);
			}


			if (row == null)
				throw new ApplicationException("Software lists not found");

			return new string[] { (string)row["title"], (string)row[type] };
		}


		public static DataSet ExecuteFill(SqlConnection connection, string commandText)
		{
			DataSet dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter(commandText, connection))
				adapter.Fill(dataSet);
			return dataSet;
		}

		public static DataSet ExecuteFill(SqlCommand command)
		{
			DataSet dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter(command))
				adapter.Fill(dataSet);
			return dataSet;
		}

	}
}

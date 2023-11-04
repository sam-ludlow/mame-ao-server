using Microsoft.Data.SqlClient;
using System.Data;

namespace mame_ao_server
{
	public class Database
	{
		public SqlConnection _SqlConnectionMachine;
		public SqlConnection _SqlConnectionSoftware;

		DataTable _PayloadMachine;

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

			dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter("SELECT * FROM [machine_payload]", _SqlConnectionMachine))
				adapter.Fill(dataSet);
			_PayloadMachine = dataSet.Tables[0];
			_PayloadMachine.TableName = "machine_payload";
			_PayloadMachine.PrimaryKey = new DataColumn[] { _PayloadMachine.Columns["machine_name"] };



		}

		public string PayloadMachine(string name, string type)
		{
			DataRow row = _PayloadMachine.Rows.Find(name);

			if (row == null)
				throw new ApplicationException($"Machine not found: '{name}'");

			return (string)row[type];
		}

		public static DataSet ExecuteFill(SqlConnection connection, string commandText)
		{
			DataSet dataSet = new DataSet();
			using (SqlDataAdapter adapter = new SqlDataAdapter(commandText, connection))
				adapter.Fill(dataSet);
			return dataSet;
		}

	}
}

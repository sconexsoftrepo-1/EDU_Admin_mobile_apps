# Connect the new Edu Admin SQL Server

Follow these steps on Windows server **WIN-SOSRVGBV993** using Remote Desktop and a Windows administrator account. You also need a SQL Server administrator login.

Target connection: **150.241.246.34**, TCP **3330**, database **Edu Admin**, SQL login **sa**. Enter your password only in the login dialog; it is intentionally omitted here.

Our test reached the public TCP port but the SQL connection was reset before login completed. This does not establish that the password is wrong. The existing database remains unchanged.

## 1. Identify the correct SQL Server instance

Open **SQL Server Configuration Manager → SQL Server Services**. Find **SQL Server (MSSQLSERVER)** or a named instance such as **SQL Server (SQLEXPRESS)**. Make sure its status is Running. Record the instance name: all later changes must apply to this same instance.

Open **SQL Server Management Studio (SSMS)** on this Windows server. Connect with Windows Authentication using an authorized administrator account:

- Default instance: `WIN-SOSRVGBV993`
- Named instance example: `WIN-SOSRVGBV993\SQLEXPRESS`

Expand **Databases** and confirm **Edu Admin** belongs to this instance. If it is missing, check other instances first. If it has never been created, right-click Databases → New Database, enter `Edu Admin`, then OK. Do not delete an existing database.

[Microsoft: identify the instance and inspect connectivity](https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/network-related-or-instance-specific-error-occurred-while-establishing-connection)

## 2. Enable SQL Server authentication

In SSMS:

1. Right-click the server at the top of Object Explorer → **Properties**.
2. Select **Security**.
3. Select **SQL Server and Windows Authentication mode** → OK.
4. Expand **Security → Logins**. Right-click **sa → Properties**.
5. Under **Status**, set Login to **Enabled** and permission to connect to **Grant**.
6. Under **General**, check the default database is `master`. Keep the known password unless you deliberately change it.
7. Click OK. Restart the SQL Server service after completing step 3 below.

Changing authentication mode requires a service restart. It does not automatically enable `sa`.

[Microsoft: authentication mode and enabling sa](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/change-server-authentication-mode?view=sql-server-ver17)

## 3. Enable TCP/IP and set port 3330

Restarting this instance briefly disconnects its applications; choose a suitable time.

1. In **SQL Server Configuration Manager**, expand **SQL Server Network Configuration**.
2. Select **Protocols for your instance**. Use the instance found in step 1.
3. Right-click **TCP/IP → Enable**, if disabled.
4. Open **TCP/IP → Properties → Protocol**. Set **Listen All = Yes**.
5. Under **IP Addresses**, scroll to **IPAll**.
6. Clear **TCP Dynamic Ports** completely, including any `0`.
7. Set **TCP Port = 3330** → Apply → OK.
8. Open **SQL Server Services**. Right-click **SQL Server (your instance) → Restart**.

With Listen All enabled, IPAll controls the port settings. Do not change SQL Server Native Client settings instead of the server's protocols.

[Microsoft: configure a fixed TCP port](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-server-to-listen-on-a-specific-tcp-port?view=sql-server-ver17)

## 4. Verify SQL Server owns the listening port

On the Windows server, open **PowerShell as Administrator** and run:

```powershell
Get-NetTCPConnection -LocalPort 3330 -State Listen |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

Take the OwningProcess number and replace `1234` below:

```powershell
Get-Process -Id 1234
```

Expected process: **sqlservr**. No listener means the SQL port configuration or restart needs checking. A different process means port 3330 belongs to another service; resolve that conflict before continuing.

In SSMS, also check **Management → SQL Server Logs → Current**. Filter for `Server is listening on`; look for TCP port **3330**. If the service failed to restart, inspect the same log for the startup error.

[Microsoft: verify the actual listening port in SQL Server logs](https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/network-related-or-instance-specific-error-occurred-while-establishing-connection)

## 5. Test the SQL login locally using TCP

In SSMS, open a new connection:

| Setting | Value |
|---|---|
| Server type | Database Engine |
| Server name | `tcp:127.0.0.1,3330` |
| Authentication | SQL Server Authentication |
| Login | `sa` |
| Password | Your existing password |
| Connect to database | `master` initially |

Use a **comma** before the port in SSMS. Keep encryption enabled. If a certificate validation error appears, record its exact text; a trusted server certificate is the permanent solution. For a diagnostic connection on the server itself, Trust server certificate can be selected while retaining encryption.

After connecting, open **New Query** and run:

```sql
SELECT @@SERVERNAME AS server_name,
       SERVERPROPERTY('IsIntegratedSecurityOnly') AS windows_auth_only;

SELECT name, state_desc
FROM sys.databases
WHERE name = N'Edu Admin';

USE [Edu Admin];
SELECT DB_NAME() AS connected_database;
```

Expected: the intended server, `windows_auth_only = 0`, database state `ONLINE`, and connected database `Edu Admin`.

## 6. Allow the SQL port through Windows Firewall

1. Press **Win + R**, enter `wf.msc`, press Enter.
2. Select **Inbound Rules → New Rule**.
3. Select **Port → TCP → Specific local ports: 3330**.
4. Select **Allow the connection**.
5. Select the profiles used by this server's network connection.
6. Name the rule **SQL Server TCP 3330** → Finish.
7. Open the rule's **Properties → Scope**. Restrict remote access to the authorized client/backend public IP addresses, or your VPN range. Do not disable Windows Firewall.

An explicit server address and port do not require SQL Server Browser or a new UDP 1434 rule.

[Microsoft: configure Windows Firewall for SQL Server](https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-windows-firewall-for-database-engine-access?view=sql-server-ver17)

## 7. Check the hosting provider firewall and forwarding

In the Windows server provider's dashboard, check any external firewall/security group. Allow inbound **TCP 3330** from the authorized connecting public IP addresses.

If the server uses NAT, confirm public `150.241.246.34:3330` forwards to this Windows server's private IP on TCP 3330, following this guide's configuration. Ask the provider to verify the mapping if you cannot see it.

If 3330 is an intentional external mapping to a different internal SQL port, use that actual internal port for the local listener and Windows Firewall instead. Keep public and internal port settings consistent with the provider's mapping.

## 8. Test from a different Windows computer

Run PowerShell from an authorized remote computer:

```powershell
Test-NetConnection 150.241.246.34 -Port 3330
```

Expected: **TcpTestSucceeded : True**. This checks TCP only, not SQL login.

In SSMS on that remote computer, connect to **tcp:150.241.246.34,3330**, using SQL Server Authentication and your existing credentials. Select `Edu Admin` after login.

## 9. Decide what to fix next

| Result | Next action |
|---|---|
| No local listener | Recheck the selected instance, TCP/IP, IPAll settings, restart, and startup log. |
| Local TCP SQL login fails | Check the full SSMS error; verify authentication mode, login status, and certificate settings. |
| Local SQL login works; remote TCP fails | Check Windows Firewall, provider firewall, allowed source IPs, and NAT. |
| Remote TCP works; SQL connection resets | Verify sqlservr owns the port, forwarding reaches the right instance, and inspect server/network logs. |
| Error 18456 | Inspect the SQL Server log for the login failure reason; check login/password and authentication mode. |
| Certificate error | Check the server certificate, trust chain, and matching DNS name; keep encryption enabled. |
| Remote SSMS login works | Tell me to retry the connection and migration. |

If you get stuck, share the step number and exact error text, without the password. Leave the current database intact until migration and verification finish.

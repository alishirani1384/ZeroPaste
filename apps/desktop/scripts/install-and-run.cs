// ZeroPaste install wrapper: run Electrobun Setup, then launch the app.
// Compiled to a WinExe (no console) by build-install-wrapper.ts.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class Program
{
    private const string AppId = "app.zeropaste.desktop";
    private const string Caption = "ZeroPaste Installer";

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    private static void Alert(string text)
    {
        MessageBoxW(IntPtr.Zero, text, Caption, 0x10); // MB_ICONERROR
    }

    private static void Info(string text)
    {
        MessageBoxW(IntPtr.Zero, text, Caption, 0x40); // MB_ICONINFORMATION
    }

    [STAThread]
    private static int Main()
    {
        try
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar
            );

            string setup = FindSetup(dir);
            if (setup == null)
            {
                Alert(
                    "Could not find ZeroPaste-Setup.exe next to this installer.\n\n"
                        + "Extract the full zip first, then run Install ZeroPaste.exe."
                );
                return 1;
            }

            string channel = ReadChannel(dir, setup) ?? "stable";
            string stem = Path.GetFileNameWithoutExtension(setup);
            string archiveA = Path.Combine(dir, ".installer", stem + ".tar.zst");
            string archiveB = Path.Combine(dir, stem + ".tar.zst");
            if (!File.Exists(archiveA) && !File.Exists(archiveB))
            {
                Alert(
                    "Missing "
                        + stem
                        + ".tar.zst.\n\nKeep the .installer folder (or archive) next to Setup when installing."
                );
                return 1;
            }

            var setupProc = Process.Start(
                new ProcessStartInfo
                {
                    FileName = setup,
                    WorkingDirectory = dir,
                    UseShellExecute = true,
                }
            );
            if (setupProc == null)
            {
                Alert("Failed to start " + Path.GetFileName(setup) + ".");
                return 1;
            }
            setupProc.WaitForExit();

            string launcher = WaitForLauncher(channel, TimeSpan.FromSeconds(30));
            if (launcher == null)
            {
                Info(
                    "Installation finished, but ZeroPaste could not be started automatically.\n\n"
                        + "Open ZeroPaste from the Desktop or Start Menu shortcut."
                );
                return 0;
            }

            Process.Start(
                new ProcessStartInfo
                {
                    FileName = launcher,
                    WorkingDirectory = Path.GetDirectoryName(launcher) ?? "",
                    UseShellExecute = true,
                }
            );
            return 0;
        }
        catch (Exception ex)
        {
            Alert("Install failed:\n\n" + ex.Message);
            return 1;
        }
    }

    private static string FindSetup(string dir)
    {
        string preferred = Path.Combine(dir, "ZeroPaste-Setup.exe");
        if (File.Exists(preferred))
            return preferred;

        foreach (string path in Directory.GetFiles(dir, "ZeroPaste-Setup*.exe"))
        {
            string name = Path.GetFileName(path);
            if (name.StartsWith("Install ", StringComparison.OrdinalIgnoreCase))
                continue;
            if (name.IndexOf("Install", StringComparison.OrdinalIgnoreCase) >= 0)
                continue;
            return path;
        }
        return null;
    }

    private static string ReadChannel(string dir, string setup)
    {
        string stem = Path.GetFileNameWithoutExtension(setup);
        string[] candidates =
        {
            Path.Combine(dir, ".installer", stem + ".metadata.json"),
            Path.Combine(dir, stem + ".metadata.json"),
        };
        foreach (string meta in candidates)
        {
            if (!File.Exists(meta))
                continue;
            try
            {
                string json = File.ReadAllText(meta, Encoding.UTF8);
                // Tiny parse: "channel":"stable"
                int key = json.IndexOf("\"channel\"", StringComparison.OrdinalIgnoreCase);
                if (key < 0)
                    continue;
                int colon = json.IndexOf(':', key);
                int q1 = json.IndexOf('"', colon + 1);
                int q2 = json.IndexOf('"', q1 + 1);
                if (q1 > 0 && q2 > q1)
                    return json.Substring(q1 + 1, q2 - q1 - 1);
            }
            catch
            {
                /* ignore */
            }
        }
        return null;
    }

    private static string WaitForLauncher(string channel, TimeSpan timeout)
    {
        string local =
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
            ?? "";
        string[] channels = { channel, "stable", "canary", "dev", "production" };
        DateTime deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            foreach (string ch in channels)
            {
                if (string.IsNullOrEmpty(ch))
                    continue;
                string path = Path.Combine(
                    local,
                    AppId,
                    ch,
                    "app",
                    "bin",
                    "launcher.exe"
                );
                if (File.Exists(path))
                    return path;
            }

            // Fallback: scan under identifier for any launcher.exe
            string root = Path.Combine(local, AppId);
            if (Directory.Exists(root))
            {
                try
                {
                    foreach (
                        string path in Directory.GetFiles(
                            root,
                            "launcher.exe",
                            SearchOption.AllDirectories
                        )
                    )
                    {
                        if (path.IndexOf("\\app\\bin\\", StringComparison.OrdinalIgnoreCase) >= 0)
                            return path;
                    }
                }
                catch
                {
                    /* ignore transient IO */
                }
            }

            Thread.Sleep(250);
        }
        return null;
    }
}

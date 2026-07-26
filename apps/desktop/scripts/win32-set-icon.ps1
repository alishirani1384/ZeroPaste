# Replace ALL PE icon resources with a single multi-size group from an .ico file.
# Uses Win32 UpdateResource — works on large Electrobun bun.exe where pe-library fails.
param(
  [Parameter(Mandatory = $true)][string]$ExePath,
  [Parameter(Mandatory = $true)][string]$IcoPath
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

public static class ZpIconBrand {
  public static readonly IntPtr RT_ICON = (IntPtr)3;
  public static readonly IntPtr RT_GROUP_ICON = (IntPtr)14;

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern IntPtr BeginUpdateResource(string fileName, bool deleteExistingResources);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool EndUpdateResource(IntPtr update, bool discard);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool UpdateResource(
    IntPtr update, IntPtr type, IntPtr name, ushort language, byte[] data, uint dataSize);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool UpdateResource(
    IntPtr update, IntPtr type, string name, ushort language, byte[] data, uint dataSize);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool EnumResourceNames(
    IntPtr module, IntPtr type, EnumResNameProc callback, IntPtr param);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool EnumResourceLanguages(
    IntPtr module, IntPtr type, IntPtr name, EnumResLangProc callback, IntPtr param);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool EnumResourceLanguages(
    IntPtr module, IntPtr type, string name, EnumResLangProc callback, IntPtr param);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern IntPtr LoadLibraryEx(string fileName, IntPtr file, uint flags);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool FreeLibrary(IntPtr module);

  const uint LOAD_LIBRARY_AS_DATAFILE = 0x00000002;

  delegate bool EnumResNameProc(IntPtr module, IntPtr type, IntPtr name, IntPtr param);
  delegate bool EnumResLangProc(IntPtr module, IntPtr type, IntPtr name, ushort lang, IntPtr param);

  class ResRef {
    public IntPtr Type;
    public bool NameIsInt;
    public IntPtr NameInt;
    public string NameStr;
    public ushort Lang;
  }

  static bool IsIntResource(IntPtr p) {
    return ((long)p >> 16) == 0;
  }

  public static void Apply(string exePath, string icoPath) {
    var ico = File.ReadAllBytes(icoPath);
    if (ico.Length < 6) throw new Exception("ico too small");
    ushort reserved = BitConverter.ToUInt16(ico, 0);
    ushort type = BitConverter.ToUInt16(ico, 2);
    ushort count = BitConverter.ToUInt16(ico, 4);
    if (reserved != 0 || type != 1 || count == 0) throw new Exception("invalid ico");

    var images = new List<byte[]>();
    var dir = new List<byte[]>();
    int offset = 6;
    for (int i = 0; i < count; i++) {
      byte w = ico[offset];
      byte h = ico[offset + 1];
      byte colors = ico[offset + 2];
      ushort planes = BitConverter.ToUInt16(ico, offset + 4);
      ushort bpp = BitConverter.ToUInt16(ico, offset + 6);
      int bytes = BitConverter.ToInt32(ico, offset + 8);
      int imgOff = BitConverter.ToInt32(ico, offset + 12);
      var img = new byte[bytes];
      Buffer.BlockCopy(ico, imgOff, img, 0, bytes);
      images.Add(img);

      var entry = new byte[14];
      entry[0] = w;
      entry[1] = h;
      entry[2] = colors;
      entry[3] = 0;
      BitConverter.GetBytes(planes).CopyTo(entry, 4);
      BitConverter.GetBytes(bpp).CopyTo(entry, 6);
      BitConverter.GetBytes(bytes).CopyTo(entry, 8);
      dir.Add(entry);
      offset += 16;
    }

    var toDelete = new List<ResRef>();
    IntPtr mod = LoadLibraryEx(exePath, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE);
    if (mod == IntPtr.Zero) throw new Exception("LoadLibraryEx failed: " + Marshal.GetLastWin32Error());
    try {
      EnumResNameProc collectNames = (m, t, name, p) => {
        var langs = new List<ushort>();
        EnumResLangProc collectLang = (m2, t2, n2, lang, p2) => {
          langs.Add(lang);
          return true;
        };
        if (IsIntResource(name)) {
          EnumResourceLanguages(m, t, name, collectLang, IntPtr.Zero);
          foreach (var lang in langs) {
            toDelete.Add(new ResRef {
              Type = t, NameIsInt = true, NameInt = name, Lang = lang
            });
          }
        } else {
          string s = Marshal.PtrToStringUni(name);
          EnumResourceLanguages(m, t, s, collectLang, IntPtr.Zero);
          foreach (var lang in langs) {
            toDelete.Add(new ResRef {
              Type = t, NameIsInt = false, NameStr = s, Lang = lang
            });
          }
        }
        return true;
      };
      EnumResourceNames(mod, RT_GROUP_ICON, collectNames, IntPtr.Zero);
      EnumResourceNames(mod, RT_ICON, collectNames, IntPtr.Zero);
    } finally {
      FreeLibrary(mod);
    }

    IntPtr update = BeginUpdateResource(exePath, false);
    if (update == IntPtr.Zero) throw new Exception("BeginUpdateResource failed: " + Marshal.GetLastWin32Error());
    bool ok = false;
    try {
      foreach (var item in toDelete) {
        bool deleted;
        if (item.NameIsInt)
          deleted = UpdateResource(update, item.Type, item.NameInt, item.Lang, null, 0);
        else
          deleted = UpdateResource(update, item.Type, item.NameStr, item.Lang, null, 0);
        if (!deleted)
          throw new Exception("Delete resource failed: " + Marshal.GetLastWin32Error());
      }

      for (int i = 0; i < images.Count; i++) {
        IntPtr id = (IntPtr)(i + 1);
        BitConverter.GetBytes((ushort)(i + 1)).CopyTo(dir[i], 12);
        if (!UpdateResource(update, RT_ICON, id, 0, images[i], (uint)images[i].Length))
          throw new Exception("UpdateResource RT_ICON failed: " + Marshal.GetLastWin32Error());
      }

      var group = new byte[6 + 14 * dir.Count];
      BitConverter.GetBytes((ushort)0).CopyTo(group, 0);
      BitConverter.GetBytes((ushort)1).CopyTo(group, 2);
      BitConverter.GetBytes((ushort)dir.Count).CopyTo(group, 4);
      for (int i = 0; i < dir.Count; i++)
        Buffer.BlockCopy(dir[i], 0, group, 6 + i * 14, 14);

      if (!UpdateResource(update, RT_GROUP_ICON, (IntPtr)1, 0, group, (uint)group.Length))
        throw new Exception("UpdateResource RT_GROUP_ICON failed: " + Marshal.GetLastWin32Error());

      ok = true;
    } finally {
      if (!EndUpdateResource(update, !ok))
        throw new Exception("EndUpdateResource failed: " + Marshal.GetLastWin32Error());
    }
  }
}
"@

[ZpIconBrand]::Apply((Resolve-Path $ExePath).Path, (Resolve-Path $IcoPath).Path)
Write-Output "OK $ExePath"

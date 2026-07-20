import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { upsertVaultMetaBlob } from "@paste/sync";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeButton } from "@/components/native-ui";
import { useAuth } from "@/contexts/auth-context";
import { useVault } from "@/contexts/vault-context";
import { probeCloudVaultMeta } from "@/components/cloud-sync";
import { saveVaultMeta } from "@/lib/vault-storage";
import { getSupabaseNative } from "@/lib/supabase";
import { colors, radii } from "@/lib/theme";
import { useAppTheme } from "@/contexts/app-theme-context";

/**
 * Same journey as desktop:
 * Account (optional offline) → cloud vault probe (signed-in only) → create / unlock → recovery key → shelf.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const vault = useVault();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();

  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [cloudProbe, setCloudProbe] = useState<"idle" | "loading" | "found" | "none">("idle");
  const probeForUser = useRef<string | null>(null);
  const uploadedMetaFor = useRef<string | null>(null);

  const needAuth = auth.configured && !auth.readyForVault;
  const ink = isDark ? colors.inkDark : colors.inkLight;
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  const bg = isDark ? colors.groupedDark : colors.groupedLight;
  const card = isDark ? colors.cardDark : colors.cardLight;
  const line = isDark ? colors.lineDark : colors.lineLight;
  const probeCloudVault = useCallback(
    async (userId: string): Promise<boolean> => {
      const sb = auth.client ?? getSupabaseNative();
      if (!sb) {
        setCloudProbe("none");
        return false;
      }
      if (probeForUser.current === userId && vault.meta) {
        setCloudProbe("found");
        return true;
      }
      probeForUser.current = userId;
      setCloudProbe("loading");
      try {
        const meta = await probeCloudVaultMeta(sb, userId);
        if (meta) {
          await saveVaultMeta(meta);
          await vault.adoptMeta(meta);
          setCloudProbe("found");
          return true;
        }
        setCloudProbe("none");
        return false;
      } catch (err) {
        console.warn("[ZeroPaste] vault cloud restore probe failed", err);
        setCloudProbe("none");
        return false;
      }
    },
    [auth.client, vault],
  );

  useEffect(() => {
    if (!auth.session || vault.meta || vault.unlocked) return;
    if (probeForUser.current === auth.session.user.id) return;
    if (cloudProbe === "loading") return;
    void probeCloudVault(auth.session.user.id);
  }, [auth.session, vault.meta, vault.unlocked, cloudProbe, probeCloudVault]);

  useEffect(() => {
    if (!vault.unlocked || vault.recoveryKeyOnce || !vault.meta || !auth.session) return;
    const sb = auth.client ?? getSupabaseNative();
    if (!sb) return;
    const uid = auth.session.user.id;
    if (uploadedMetaFor.current === uid) return;
    uploadedMetaFor.current = uid;
    void upsertVaultMetaBlob(sb, uid, vault.meta).catch((err) => {
      console.warn("[ZeroPaste] vault meta upload failed", err);
      uploadedMetaFor.current = null;
    });
  }, [vault.unlocked, vault.recoveryKeyOnce, vault.meta, auth.session, auth.client]);

  if (!vault.ready || auth.loading) {
    return (
      <GateShell bg={bg} insetsTop={insets.top} insetsBottom={insets.bottom}>
        <BusyBlock ink={ink} muted={muted} label="Starting…" detail="Checking your session" />
      </GateShell>
    );
  }

  if (needAuth) {
    return (
      <GateShell bg={bg} insetsTop={insets.top} insetsBottom={insets.bottom}>
        <LargeTitle ink={ink} title="Sign In" subtitle="Sync is optional. Your vault stays on-device." />
        <InsetGroup card={card}>
          <InsetField
            label="Email"
            value={email}
            onChange={setEmail}
            ink={ink}
            muted={muted}
            line={line}
            autoCapitalize="none"
            keyboardType="email-address"
            last={false}
          />
          <InsetField
            label="Password"
            value={password}
            onChange={setPassword}
            ink={ink}
            muted={muted}
            line={line}
            secure
            last
          />
        </InsetGroup>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {authMsg ? <Text style={[styles.footerNote, { color: muted }]}>{authMsg}</Text> : null}
        <View style={styles.actions}>
          <NativeButton
            label={busy ? "Signing In…" : "Sign In"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              setAuthMsg(null);
              setCloudProbe("loading");
              try {
                await auth.signIn(email.trim(), password);
                if (!vault.meta) {
                  const sb = auth.client ?? getSupabaseNative();
                  const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
                  const uid = data.session?.user.id;
                  if (sb && uid) await probeCloudVault(uid);
                  else setCloudProbe("none");
                } else {
                  setCloudProbe("idle");
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign in failed");
                setCloudProbe("idle");
                probeForUser.current = null;
              } finally {
                setBusy(false);
              }
            }}
          />
          <NativeButton
            label="Create Account"
            variant="secondary"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                const msg = await auth.signUp(email.trim(), password);
                setAuthMsg(msg);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign up failed");
              } finally {
                setBusy(false);
              }
            }}
          />
          <NativeButton
            label="Continue Without Account"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setError(null);
              setAuthMsg(null);
              setCloudProbe("none");
              auth.continueOffline();
            }}
          />
        </View>
      </GateShell>
    );
  }

  const awaitingCloudVault =
    Boolean(auth.session) && !vault.meta && !vault.unlocked && cloudProbe !== "none";

  if (awaitingCloudVault) {
    return (
      <GateShell bg={bg} insetsTop={insets.top} insetsBottom={insets.bottom}>
        <BusyBlock ink={ink} muted={muted} label="Restoring Vault" detail="Looking for your encrypted vault" />
      </GateShell>
    );
  }

  if (vault.unlocked && vault.recoveryKeyOnce) {
    return (
      <GateShell bg={bg} insetsTop={insets.top} insetsBottom={insets.bottom}>
        <LargeTitle
          ink={ink}
          title="Recovery Key"
          subtitle="Save this offline. It’s the only way back if you forget your passphrase."
        />
        <View style={[styles.recoveryBox, { backgroundColor: card }]}>
          <Text selectable style={[styles.recoveryText, { color: ink }]}>
            {vault.recoveryKeyOnce}
          </Text>
        </View>
        <View style={styles.actions}>
          <NativeButton
            label="Copy & Continue"
            onPress={() => {
              void (async () => {
                try {
                  await Clipboard.setStringAsync(vault.recoveryKeyOnce!);
                } catch {
                  /* ignore */
                }
                vault.clearRecoveryKeyOnce();
              })();
            }}
          />
        </View>
      </GateShell>
    );
  }

  if (vault.unlocked) return <>{children}</>;

  const isSetup = !vault.meta;

  const submit = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setError(null);
    setBusy(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const unlockTimeout = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "Unlock timed out. Argon2 may be unsupported in this Expo Go build — try a newer Expo Go or a dev client.",
            ),
          ),
        60_000,
      );
    });

    try {
      const run = async () => {
        if (isSetup) {
          if (pass.length < 8) throw new Error("Use at least 8 characters");
          if (pass !== pass2) throw new Error("Passphrases do not match");
          await vault.setupVault(pass);
        } else if (mode === "recovery") {
          await vault.unlockRecovery(pass.trim());
        } else {
          if (!pass.trim()) throw new Error("Enter your vault passphrase");
          await vault.unlock(pass);
        }
      };
      await Promise.race([run(), unlockTimeout]);
      setPass("");
      setPass2("");
    } catch (e) {
      console.warn("[vault] unlock/setup failed", e);
      setError(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateShell bg={bg} insetsTop={insets.top} insetsBottom={insets.bottom}>
      <LargeTitle
        ink={ink}
        title={isSetup ? "Create Vault" : "Unlock"}
        subtitle={
          isSetup
            ? "Your passphrase never leaves this device. You’ll stay unlocked for 7 days."
            : "Enter your passphrase. You’ll stay unlocked for 7 days on this device."
        }
      />

      {auth.session ? (
        <Text style={[styles.footerNote, { color: muted }]}>{auth.session.user.email}</Text>
      ) : auth.offlineChosen ? (
        <Text style={[styles.footerNote, { color: muted }]}>Offline — sync off until you sign in</Text>
      ) : null}

      {auth.configured && auth.offlineChosen && !auth.session ? (
        <Pressable
          onPress={() => {
            setError(null);
            setPass("");
            setPass2("");
            setCloudProbe("idle");
            auth.cancelOffline();
          }}
          style={styles.backLink}
        >
          <Text style={styles.link}>Sign In Instead</Text>
        </Pressable>
      ) : null}

      {!isSetup ? (
        <Segmented
          isDark={isDark}
          ink={ink}
          value={mode}
          onChange={setMode}
          options={[
            { id: "passphrase", label: "Passphrase" },
            { id: "recovery", label: "Recovery" },
          ]}
        />
      ) : null}

      <InsetGroup card={card}>
        <InsetField
          label={
            isSetup ? "Passphrase" : mode === "recovery" ? "Recovery Key" : "Passphrase"
          }
          value={pass}
          onChange={setPass}
          ink={ink}
          muted={muted}
          line={line}
          secure={mode !== "recovery" || isSetup}
          autoCapitalize="none"
          onSubmitEditing={() => void submit()}
          last={!isSetup}
        />
        {isSetup ? (
          <InsetField
            label="Confirm"
            value={pass2}
            onChange={setPass2}
            ink={ink}
            muted={muted}
            line={line}
            secure
            autoCapitalize="none"
            onSubmitEditing={() => void submit()}
            last
          />
        ) : null}
      </InsetGroup>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={muted} />
          <Text style={[styles.busyText, { color: muted }]}>
            {isSetup ? "Creating vault…" : "Deriving key…"}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <NativeButton
          label={busy ? "Working…" : isSetup ? "Create Vault" : "Unlock"}
          disabled={busy}
          onPress={() => void submit()}
        />
      </View>
    </GateShell>
  );
}

function GateShell({
  children,
  bg,
  insetsTop,
  insetsBottom,
}: {
  children: ReactNode;
  bg: string;
  insetsTop: number;
  insetsBottom: number;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={[
        styles.gate,
        { paddingTop: insetsTop + 12, paddingBottom: insetsBottom + 32 },
      ]}
      keyboardShouldPersistTaps="always"
    >
      {children}
    </ScrollView>
  );
}

function LargeTitle({
  title,
  subtitle,
  ink,
}: {
  title: string;
  subtitle: string;
  ink: string;
}) {
  const { isDark } = useAppTheme();
  const muted = isDark ? colors.mutedDark : colors.mutedLight;
  return (
    <View style={styles.titleBlock}>
      <Text style={[styles.largeTitle, { color: ink }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
    </View>
  );
}

function BusyBlock({
  label,
  detail,
  ink,
  muted,
}: {
  label: string;
  detail: string;
  ink: string;
  muted: string;
}) {
  return (
    <View style={styles.busyBlock}>
      <ActivityIndicator color={muted} size="large" />
      <Text style={[styles.largeTitle, { color: ink, marginTop: 20, fontSize: 28 }]}>{label}</Text>
      <Text style={[styles.subtitle, { color: muted }]}>{detail}</Text>
    </View>
  );
}

function InsetGroup({ children, card }: { children: ReactNode; card: string }) {
  return <View style={[styles.insetGroup, { backgroundColor: card }]}>{children}</View>;
}

function InsetField({
  label,
  value,
  onChange,
  muted,
  ink,
  line,
  secure,
  autoCapitalize,
  keyboardType,
  onSubmitEditing,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  muted: string;
  ink: string;
  line: string;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "email-address";
  onSubmitEditing?: () => void;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.insetRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line },
      ]}
    >
      <Text style={[styles.insetLabel, { color: muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        autoComplete={secure ? "password" : "off"}
        textContentType={secure ? "password" : "none"}
        keyboardType={keyboardType ?? "default"}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        placeholderTextColor={muted}
        style={[styles.insetInput, { color: ink }]}
      />
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  isDark,
  ink,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  isDark: boolean;
  ink: string;
}) {
  return (
    <View
      style={[
        styles.segment,
        { backgroundColor: isDark ? "rgba(118,118,128,0.24)" : "rgba(118,118,128,0.12)" },
      ]}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[
              styles.segmentItem,
              active && {
                backgroundColor: isDark ? "#636366" : "#FFFFFF",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              },
            ]}
          >
            <Text
              style={{
                color: ink,
                fontSize: 13,
                fontWeight: active ? "600" : "500",
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { paddingHorizontal: 16 },
  titleBlock: { marginTop: 8, marginBottom: 20, paddingHorizontal: 4 },
  largeTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.37,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 20,
  },
  footerNote: {
    marginTop: -8,
    marginBottom: 12,
    marginHorizontal: 4,
    fontSize: 13,
  },
  backLink: { marginBottom: 12, marginHorizontal: 4 },
  link: { color: colors.link, fontSize: 17 },
  insetGroup: {
    borderRadius: radii.card,
    overflow: "hidden",
  },
  insetRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
    justifyContent: "center",
  },
  insetLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  insetInput: {
    fontSize: 17,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  actions: {
    marginTop: 20,
    gap: 4,
  },
  error: {
    marginTop: 12,
    marginHorizontal: 4,
    color: colors.crimson,
    fontSize: 14,
  },
  busyRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  busyText: { fontSize: 15 },
  busyBlock: {
    marginTop: 80,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  recoveryBox: {
    borderRadius: radii.card,
    padding: 16,
  },
  recoveryText: {
    fontFamily: "monospace",
    fontSize: 14,
    lineHeight: 22,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 9,
    padding: 2,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn("[pwa] sw registration failed", err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast("Neue Version verfügbar", {
      description: "Tippe auf Aktualisieren, um die neueste Version zu laden.",
      duration: Infinity,
      action: {
        label: "Aktualisieren",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      onDismiss: () => setNeedRefresh(false),
    });
    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

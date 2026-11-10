import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getKnownGroups, setGroupId } from "@/lib/auth";
import { setActiveGroup } from "@/lib/storage";

/**
 * Push-Link mit Gruppe (/g/:groupId, /g/:groupId/wishlist): wechselt in die
 * Gruppe, sofern sie auf diesem Gerät bekannt ist, und geht weiter zum Ziel.
 */
export default function GroupLink({ to }: { to: string }) {
  const { groupId } = useParams<{ groupId: string }>();
  const nav = useNavigate();

  useEffect(() => {
    if (groupId && getKnownGroups().includes(groupId)) {
      setGroupId(groupId);
      setActiveGroup(groupId);
    }
    nav(to, { replace: true });
  }, [groupId, to, nav]);

  return null;
}

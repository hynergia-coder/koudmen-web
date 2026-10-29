import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Booking } from "../Dashboard";

export default function Payments() {
  const [list, setList] = useState(null);
  const load = useCallback(() => {
    supabase.from("bookings").select("*, helpers(display_name, island, city, rate)")
      .eq("payment_status", "paid").order("paid_at").then(({ data }) => setList(data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <p className="muted">Missions payées dont l'argent n'est pas encore versé. Intervenez en cas de litige ou si une famille ne confirme pas une mission terminée.</p>
      {list === null && <p className="muted" style={{ marginTop: 16 }}>Chargement…</p>}
      {list?.length === 0 && <p className="muted" style={{ marginTop: 16 }}>Aucun paiement en séquestre.</p>}
      {list?.length > 0 && <section className="panel" style={{ marginTop: 16 }}>{list.map((b) => <Booking key={b.id} b={b} asAdmin onChange={load} />)}</section>}
    </>
  );
}

// One stat in the dark achievement row: icon, the admin-entered value and a
// label. The value is rendered verbatim - suffixes like "+" or "%" belong to
// the content, not to this component. Presentational.
interface CounterItemProps {
  icon?: string | null;
  value: string;
  label: string;
  divider?: boolean;
}

export default function CounterItem({ icon, value, label, divider = true }: CounterItemProps) {
  return (
    <div className={divider ? "pe-[70px] md:border-e-2 md:border-[rgba(243,247,251,0.16)]" : ""}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-[60px] w-[60px] object-contain" />
      ) : null}
      <h2 className="mt-5 font-display text-[40px] font-bold leading-[50px] text-base">{value}</h2>
      <p className="leading-[28px] text-base">{label}</p>
    </div>
  );
}

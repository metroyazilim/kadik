// Süreç adımı: numaralı daire + başlık/metin. İkon opsiyoneldir; yönetim
// panelinden ikon seçilmediğinde daire yalnız adım numarasını taşır.
// `reversed` çift sıralı adımlarda metni üste alır, böylece bölümün CSS
// bağlantı çizgisi dairelerin üzerinden geçer.
interface ProcessStepProps {
  index: number;
  icon?: string | null;
  title: string;
  text: string;
  reversed?: boolean;
}

export default function ProcessStep({ index, icon, title, text, reversed = false }: ProcessStepProps) {
  const circle = (
    <div
      className={`relative mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-[50%] bg-base shadow-[var(--shadow-card)] ${
        reversed ? "" : "mb-[30px]"
      }`}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-10 w-10 object-contain" />
      ) : null}
      <span className="absolute start-0 top-0 flex h-[34px] w-[34px] items-center justify-center rounded-[50%] bg-brand font-display text-[18px] text-base">
        {index}
      </span>
    </div>
  );

  const content = (
    <div className={reversed ? "mb-[30px]" : ""}>
      <h4 className="mb-[5px] font-display text-[24px] font-bold leading-[34px] text-ink">{title}</h4>
      <p className="leading-[28px] text-muted">{text}</p>
    </div>
  );

  return (
    <div className="text-center">
      {reversed ? (
        <>
          {content}
          {circle}
        </>
      ) : (
        <>
          {circle}
          {content}
        </>
      )}
    </div>
  );
}

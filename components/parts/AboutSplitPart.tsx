import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ThemeButton from "@/components/ThemeButton";
import { IconCheck, IconPhone, IconPlay } from "@/components/Icon";

export type AboutSplitPartProps = Readonly<{
  subtitle?: string;
  title?: string;
  text?: string;
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  checklist?: readonly string[];
  statValue?: string;
  statLabel?: string;
  phoneLabel?: string;
  phoneNumber?: string;
  phoneHref?: string;
  buttonLabel?: string;
  buttonHref?: string;
  imagePosition?: "left" | "right";
}>;

export function AboutSplitPart({
  subtitle = "",
  title = "",
  text = "",
  imageUrl = "/about-team.webp",
  imageAlt = "",
  videoUrl,
  checklist = [],
  statValue = "",
  statLabel = "",
  phoneLabel = "",
  phoneNumber = "",
  phoneHref = "",
  buttonLabel = "",
  buttonHref = "",
  imagePosition = "left",
}: AboutSplitPartProps) {
  const imageColumn = (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={imageAlt} className="w-full rounded-2xl object-cover" />
      <span className="anim-ripple absolute start-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-base">
        <IconPlay className="h-7 w-7" />
      </span>
    </div>
  );

  const contentColumn = (
    <div>
      <SectionHeading subtitle={subtitle} title={title} />
      {text.trim() ? <p className="mt-6 border-b border-hairline pb-7 leading-7 text-muted">{text}</p> : null}
      {(checklist && checklist.length > 0) || (statValue.trim() || statLabel.trim()) ? (
        <div className="mt-7 grid gap-8 sm:grid-cols-[1fr_auto]">
          {checklist && checklist.length > 0 ? (
            <ul className="space-y-3 font-medium text-muted">
              {checklist.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <IconCheck className="h-4 w-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {(statValue.trim() || statLabel.trim()) ? (
            <div className="border-s-[3px] border-brand bg-base px-7 py-5 shadow-[var(--shadow-card)]">
              {statValue.trim() ? <strong className="font-display text-[30px] text-ink">{statValue}</strong> : null}
              {statLabel.trim() ? <p className="text-sm text-muted">{statLabel}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-9 flex flex-wrap items-center gap-8">
        {buttonLabel.trim() && buttonHref.trim() ? (
          <ThemeButton href={buttonHref}>{buttonLabel}</ThemeButton>
        ) : null}
        {phoneNumber.trim() ? (
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-base">
              <IconPhone className="h-5 w-5" />
            </span>
            <div>
              {phoneLabel.trim() ? <p className="text-sm font-semibold text-ink">{phoneLabel}</p> : null}
              <a href={phoneHref} dir="ltr" className="font-display text-xl font-semibold text-brand">
                {phoneNumber}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section id="about" className="py-[120px]">
      <Reveal className="mx-auto grid max-w-7xl items-center gap-16 px-[15px] lg:grid-cols-2">
        {imagePosition === "left" ? (
          <>
            {imageColumn}
            {contentColumn}
          </>
        ) : (
          <>
            {contentColumn}
            {imageColumn}
          </>
        )}
      </Reveal>
    </section>
  );
}

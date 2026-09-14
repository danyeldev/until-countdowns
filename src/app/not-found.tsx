import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="eyebrow">404 · A little off the calendar</p>
      <h1 className="mt-4 page-heading">This moment got away.</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        We couldn’t find that countdown. The date may have moved or the link may
        be incomplete. There’s still plenty to look forward to.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="button-primary">
          Explore countdowns <Icon name="arrow" size={16} />
        </Link>
        <Link href="/create" className="button-secondary">
          Make your own
        </Link>
      </div>
    </section>
  );
}

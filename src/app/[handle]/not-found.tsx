import Link from "next/link";
import { Icon } from "@/components/Icon";
import { loginHref } from "@/lib/auth/paths";

export default function ProfileNotFound() {
  return (
    <section className="mx-auto max-w-xl py-16 text-center sm:py-24">
      <p className="eyebrow">404 · No one here</p>
      <h1 className="page-heading mt-4">We couldn’t find that profile.</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        That handle is free, or it isn’t public yet. Create an account to claim a name of your own.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="button-primary">
          Explore countdowns <Icon name="arrow" size={16} />
        </Link>
        <Link href={loginHref("/", { mode: "signup" })} className="button-secondary">
          Create an account
        </Link>
      </div>
    </section>
  );
}

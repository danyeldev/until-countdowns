import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body>
        <section className="mx-auto max-w-xl py-16 text-center sm:py-24">
          <p className="eyebrow">404</p>
          <h1 className="mt-4 page-heading">This moment got away.</h1>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="button-primary">
              Explore countdowns <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>
      </body>
    </html>
  );
}

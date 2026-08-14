import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return <main><SiteHeader /><section className="not-found"><span>404</span><h1>Такого разбора пока нет</h1><p>Вернитесь в каталог или предложите песню Никите.</p><div><Link className="button button-outline" href="/#catalog">Открыть каталог</Link><a className="button button-primary" href="https://t.me/nikguitar">Предложить песню</a></div></section></main>;
}

import { LandingMotion } from "@/components/LandingMotion";
import { LandingNav } from "@/components/landing/LandingNav";
import { Loader } from "@/components/landing/Loader";
import { SceneClimax } from "@/components/landing/SceneClimax";
import { SceneContext } from "@/components/landing/SceneContext";
import { SceneCta } from "@/components/landing/SceneCta";
import { SceneEngram } from "@/components/landing/SceneEngram";
import { SceneForget } from "@/components/landing/SceneForget";
import { SceneIndex } from "@/components/landing/SceneIndex";
import { SceneInterfaces } from "@/components/landing/SceneInterfaces";
import { SceneLoop } from "@/components/landing/SceneLoop";

export function LandingPage() {
  return (
    <LandingMotion className="landing-scope relative min-h-screen w-full max-w-full overflow-x-clip bg-lp text-li">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-lsignal focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-semibold focus:text-lp"
      >
        Skip to content
      </a>
      <Loader />
      <LandingNav />
      <main id="main-content" tabIndex={-1}>
        <SceneForget />
        <SceneEngram />
        <SceneLoop />
        <SceneContext />
        <SceneInterfaces />
        <SceneIndex />
        <SceneClimax />
        <SceneCta />
      </main>
    </LandingMotion>
  );
}

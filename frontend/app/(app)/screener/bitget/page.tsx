import { BitgetTerminalV3 } from "@/components/bitget/bitget-terminal-v3";
import { BitgetBriefingCommandCenter } from "@/components/bitget/bitget-briefing-command-center";

export default function BitgetScreenerPage() {
  return <div className="mx-auto w-full max-w-[1700px] space-y-4 pb-12"><BitgetBriefingCommandCenter /><BitgetTerminalV3 showRadar={false} /></div>;
}

import { AxiosError } from "axios";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";

import { getClient } from "@/api/AxiosClient";
import { DebugSessionApiResponse } from "@/api/types";
import { AnimatedWave } from "@/components/AnimatedWave";
import { BrowserStream } from "@/components/BrowserStream";
import { FloatingWindow } from "@/components/FloatingWindow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { useCredentialGetter } from "@/hooks/useCredentialGetter";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useUser } from "@/hooks/useUser";
import { statusIsFinalized } from "@/routes/tasks/types.ts";
import { useSidebarStore } from "@/store/SidebarStore";
import { useWorkflowHasChangesStore } from "@/store/WorkflowHasChangesStore";
import { useWorkflowRunQuery } from "@/routes/workflows/hooks/useWorkflowRunQuery";
import { useWorkflowQuery } from "../hooks/useWorkflowQuery";
import { useDebugSessionQuery } from "../hooks/useDebugSessionQuery";
import { WorkflowSettings } from "../types/workflowTypes";
import { FlowRenderer } from "./FlowRenderer";
import { getElements } from "./workflowEditorUtils";
import { getInitialParameters } from "./utils";

function WorkflowDebugger() {
  const { blockLabel, workflowPermanentId } = useParams();
  const [openDialogue, setOpenDialogue] = useState(false);
  const [activeDebugSession, setActiveDebugSession] =
    useState<DebugSessionApiResponse | null>(null);
  const credentialGetter = useCredentialGetter();
  const queryClient = useQueryClient();
  const [shouldFetchDebugSession, setShouldFetchDebugSession] = useState(false);
  const user = useUser().get();
  const email = user?.email;
  const isSkyvernUser = email?.toLowerCase().endsWith("@skyvern.com") ?? false;

  const { data: workflowRun } = useWorkflowRunQuery();
  const { data: workflow } = useWorkflowQuery({
    workflowPermanentId,
  });

  const { data: debugSession } = useDebugSessionQuery({
    workflowPermanentId,
    enabled: shouldFetchDebugSession && !!workflowPermanentId,
  });

  const setCollapsed = useSidebarStore((state) => {
    return state.setCollapsed;
  });

  const setHasChanges = useWorkflowHasChangesStore(
    (state) => state.setHasChanges,
  );

  const handleOnCycle = () => {
    setOpenDialogue(true);
  };

  useMountEffect(() => {
    setCollapsed(true);
    setHasChanges(false);

    if (workflowPermanentId) {
      queryClient.removeQueries({
        queryKey: ["debugSession", workflowPermanentId],
      });
      setShouldFetchDebugSession(true);
    }
  });

  const cycleBrowser = useMutation({
    mutationFn: async (id: string) => {
      const client = await getClient(credentialGetter, "sans-api-v1");
      return client.post<DebugSessionApiResponse>(`/debug-session/${id}/new`);
    },
    onSuccess: (response) => {
      const newDebugSession = response.data;
      setActiveDebugSession(newDebugSession);

      queryClient.invalidateQueries({
        queryKey: ["debugSession", workflowPermanentId],
      });

      toast({
        title: "Browser cycled",
        variant: "success",
        description: "Your browser has been cycled.",
      });

      setOpenDialogue(false);
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        title: "Failed to cycle browser",
        description: error.message,
      });
      setOpenDialogue(false);
    },
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (
      (!debugSession || !debugSession.browser_session_id) &&
      shouldFetchDebugSession &&
      workflowPermanentId
    ) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({
          queryKey: ["debugSession", workflowPermanentId],
        });
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (debugSession) {
        setActiveDebugSession(debugSession);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [debugSession, shouldFetchDebugSession, workflowPermanentId, queryClient]);

  if (!workflow) {
    return null;
  }

  const settings: WorkflowSettings = {
    persistBrowserSession: workflow.persist_browser_session,
    proxyLocation: workflow.proxy_location,
    webhookCallbackUrl: workflow.webhook_callback_url,
    model: workflow.model,
    maxScreenshotScrolls: workflow.max_screenshot_scrolls,
    extraHttpHeaders: workflow.extra_http_headers
      ? JSON.stringify(workflow.extra_http_headers)
      : null,
  };

  const elements = getElements(
    workflow.workflow_definition.blocks,
    settings,
    true,
  );

  const isFinalized = workflowRun ? statusIsFinalized(workflowRun) : null;
  const interactor = workflowRun && isFinalized === false ? "agent" : "human";
  const browserTitle = interactor === "agent" ? `Browser [🤖]` : `Browser [👤]`;

  return (
    <div className="relative flex h-screen w-full">
      <Dialog
        open={openDialogue}
        onOpenChange={(open) => {
          if (!open && cycleBrowser.isPending) {
            return;
          }
          setOpenDialogue(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cycle (Get a new browser)</DialogTitle>
            <DialogDescription>
              <div className="pb-2 pt-4 text-sm text-slate-400">
                {cycleBrowser.isPending ? (
                  <>
                    Cooking you up a fresh browser...
                    <AnimatedWave text=".‧₊˚ ⋅ ✨★ ‧₊˚ ⋅" />
                  </>
                ) : (
                  "Abandon this browser for a new one. Are you sure?"
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {!cycleBrowser.isPending && (
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
            )}
            <Button
              variant="default"
              onClick={() => {
                cycleBrowser.mutate(workflowPermanentId!);
              }}
              disabled={cycleBrowser.isPending}
            >
              Yes, Continue{" "}
              {cycleBrowser.isPending && (
                <ReloadIcon className="ml-2 size-4 animate-spin" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReactFlowProvider>
        <FlowRenderer
          initialEdges={elements.edges}
          initialNodes={elements.nodes}
          initialParameters={getInitialParameters(workflow)}
          initialTitle={workflow.title}
          workflow={workflow}
        />
      </ReactFlowProvider>

      {activeDebugSession && (
        <FloatingWindow
          title={browserTitle}
          bounded={false}
          initialWidth={512}
          initialHeight={360}
          showMaximizeButton={true}
          showMinimizeButton={true}
          showPowerButton={blockLabel === undefined && isSkyvernUser}
          showReloadButton={true}
          // --
          onCycle={handleOnCycle}
        >
          {activeDebugSession && activeDebugSession.browser_session_id ? (
            <BrowserStream
              interactive={interactor === "human"}
              browserSessionId={activeDebugSession.browser_session_id}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </FloatingWindow>
      )}
    </div>
  );
}

export { WorkflowDebugger };

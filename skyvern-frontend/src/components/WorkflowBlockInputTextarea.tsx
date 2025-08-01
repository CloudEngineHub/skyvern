import { PlusIcon } from "@radix-ui/react-icons";
import { cn } from "@/util/utils";
import { AutoResizingTextarea } from "./AutoResizingTextarea/AutoResizingTextarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { WorkflowBlockParameterSelect } from "@/routes/workflows/editor/nodes/WorkflowBlockParameterSelect";
import { useWorkflowTitleStore } from "@/store/WorkflowTitleStore";
import { useRef, useState } from "react";

type Props = Omit<
  React.ComponentProps<typeof AutoResizingTextarea>,
  "onChange"
> & {
  canWriteTitle?: boolean;
  onChange: (value: string) => void;
  nodeId: string;
};

function WorkflowBlockInputTextarea(props: Props) {
  const { maybeAcceptTitle, maybeWriteTitle } = useWorkflowTitleStore();
  const { nodeId, onChange, canWriteTitle = false, ...textAreaProps } = props;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const handleOnBlur = () => {
    if (canWriteTitle) {
      maybeAcceptTitle();
    }
  };

  const handleOnChange = (value: string) => {
    onChange(value);
    if (canWriteTitle) {
      maybeWriteTitle(value);
    }
  };

  const handleTextareaSelect = () => {
    if (textareaRef.current) {
      setCursorPosition({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      });
    }
  };

  const insertParameterAtCursor = (parameterKey: string) => {
    const value = props.value ?? "";
    const parameterText = `{{${parameterKey}}}`;

    if (cursorPosition && textareaRef.current) {
      const { start, end } = cursorPosition;
      const newValue =
        value.substring(0, start) + parameterText + value.substring(end);

      handleOnChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = start + parameterText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    } else {
      handleOnChange(`${value}${parameterText}`);
    }
  };

  return (
    <div className="relative">
      <AutoResizingTextarea
        {...textAreaProps}
        ref={textareaRef}
        onBlur={handleOnBlur}
        onChange={(event) => {
          handleOnChange(event.target.value);
          handleTextareaSelect();
        }}
        onClick={handleTextareaSelect}
        onKeyUp={handleTextareaSelect}
        onSelect={handleTextareaSelect}
        className={cn("pr-9", props.className)}
      />
      <div className="absolute right-0 top-0 flex size-9 cursor-pointer items-center justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <div className="rounded p-1 hover:bg-muted">
              <PlusIcon className="size-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-[22rem]">
            <WorkflowBlockParameterSelect
              nodeId={nodeId}
              onAdd={insertParameterAtCursor}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export { WorkflowBlockInputTextarea };

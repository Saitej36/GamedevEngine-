# Unreal 5.4 Behavior Trees, Blackboards, EQS and AI Perception

> **Adapted reference — community source, not official documentation.**
> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c41c839b68319ffc08430b99ab768debc32 — skills/unreal/unreal-behavior-trees/SKILL.md, skills/unreal/unreal-behavior-trees/references/custom-bttask.md
> License: Apache-2.0 (see licenses/). Modified by Pixel Studio: re-targeted from UE 5.8 to UE 5.4; removed 5.8/5.9 StateTree and EQS features (queued StateTree compilation, starting states, bStripFromClientBuilds, script editing); reduced StateTree to a verify note; removed find/grep and headless test commands; added a perception section; condensed.
> Engine target: Unreal Engine 5.4. Code is illustrative and has NOT been compiled or run.

## How the pieces fit

- **Blackboard (`BB_`)**: typed keys for every fact the AI remembers (`TargetActor` Object, `LastKnownLocation` Vector, `bIsInvestigating` Bool). Make it first; the tree references it.
- **Behavior Tree (`BT_`)**: composites (Selector = OR, stops at first success; Sequence = AND, stops at first failure), tasks (leaves), decorators (conditions on a branch), services (tick while their branch is active to refresh keys).
- **AIController** runs the tree: `RunBehaviorTree(BT)` in `OnPossess`, which also initializes the Blackboard. The pawn needs AI Controller Class set and Auto Possess AI = "Placed in World or Spawned".
- C++ AI code needs `"AIModule"` (and usually `"GameplayTasks"`, `"NavigationSystem"`) in Build.cs.

```cpp
void AEnemyAIController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);
    if (BehaviorTree) { RunBehaviorTree(BehaviorTree); }  // UPROPERTY TObjectPtr<UBehaviorTree>
}

void AEnemyAIController::SetTarget(AActor* Target)
{
    if (UBlackboardComponent* BB = GetBlackboardComponent())
        BB->SetValueAsObject(TEXT("TargetActor"), Target);  // must match the key name exactly
}
```

`BB->ClearValue(TEXT("TargetActor"))` drops the tree back to a lower-priority branch.

## A reactive priority tree and observer aborts

```text
ROOT -> Selector
  ├─ Sequence [BB: TargetActor Is Set, Observer Aborts: Both]
  │    ├─ MoveTo (TargetActor)
  │    └─ Attack
  ├─ Sequence [BB: LastKnownLocation Is Set, Observer Aborts: Lower Priority]
  │    ├─ MoveTo (LastKnownLocation)
  │    └─ Wait 3s, then clear the key
  └─ Sequence (patrol)
       ├─ Run EQS Query (EQS_NextPatrolPoint -> PatrolLocation)
       └─ MoveTo (PatrolLocation)
```

Observer Aborts on a Blackboard decorator decides what a key change interrupts:

- `None`: the tree ignores the change until it naturally re-evaluates (the usual "AI ignores me" bug).
- `Self`: aborts this branch when its condition becomes false.
- `Lower Priority`: interrupts branches to its right when its condition becomes true.
- `Both`: both. On the combat branch it means "start the moment a target is set, leave the moment it clears".

Key typos fail silently. Use `FBlackboardKeySelector` properties or one shared constant per key name.

## Custom BTTask in C++

Write custom nodes only when built-ins cannot do it. Tasks are **not instanced** by default: one node object is shared by every AI running the asset, so member UPROPERTYs are read-only settings and per-AI state goes in node memory.

```cpp
struct FWaitRandomMemory { FTimerHandle Timer; };

UCLASS()
class MYGAME_API UBTTask_WaitRandom : public UBTTaskNode
{
    GENERATED_BODY()
public:
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
    virtual EBTNodeResult::Type AbortTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
    virtual uint16 GetInstanceMemorySize() const override { return sizeof(FWaitRandomMemory); }
    UPROPERTY(EditAnywhere, Category="Wait") float MinTime = 1.f;
    UPROPERTY(EditAnywhere, Category="Wait") float MaxTime = 3.f;
};
```

- Instant task: do the work and return `Succeeded` or `Failed`.
- Latent task: return `InProgress`, then call `FinishLatentTask(OwnerComp, EBTNodeResult::Succeeded)` from the timer or delegate. Capture the component as `TWeakObjectPtr` in the callback; it can be destroyed first.
- `AbortTask`: clear the pending timer (read the handle via `CastInstanceNodeMemory<FWaitRandomMemory>(NodeMemory)`) and return `Aborted`, or return `InProgress` and later call `FinishLatentAbort`.
- A task that returns `InProgress` and never finishes hangs the tree.
- Set `NodeName` in the constructor. `OwnerComp.GetAIOwner()` gives the controller, `->GetPawn()` the pawn.
- Deriving from `UBTTask_BlackboardBase` gives a resolved `BlackboardKey`; with your own selector, add a type filter (for example `AddObjectFilter`) in the constructor and resolve it in `InitializeFromAsset`.
- Custom Service: subclass `UBTService`, override `TickNode`. Custom Decorator: subclass `UBTDecorator`, override `CalculateRawConditionValue`.
- Verify on 5.4: whether the `InitializeMemory` / `CleanupMemory` overrides with `InitializeNodeMemory<T>` / `CleanupNodeMemory<T>` helpers used upstream exist in the 5.4 `BTNode.h`; if not, rely on `GetInstanceMemorySize` and placement-construct the struct in `ExecuteTask`.

## EQS for "where" and "which"

Use a Run EQS Query task with a Query Template and a Blackboard key that receives the best item (cover point, nearest pickup, next patrol point). Pass parameters with Query Config. Only the left-most generator connected to the root runs. Debug with an EQS Testing Pawn placed in the level before blaming the tree; results also show in the Visual Logger. EQS is server-side AI: do not run queries from client-only code. Not on 5.4 — the `bStripFromClientBuilds` query flag was added in 5.8.

## AI Perception

Give the AIController a `UAIPerceptionComponent` with a `UAISenseConfig_Sight` (and Hearing/Damage if needed), and bind `OnTargetPerceptionUpdated(AActor*, FAIStimulus)`. In the handler, `Stimulus.WasSuccessfullySensed()` sets `TargetActor`; on loss, clear it and write `Stimulus.StimulusLocation` into `LastKnownLocation`. Configure it in the constructor (sight radius, lose-sight radius, peripheral angle) and call `ConfigureSense` / `SetDominantSense`.

- Sight sees nothing: Detection By Affiliation only has Neutrals ticked, or teams are not set up. Without `IGenericTeamAgentInterface` on both sides, everything is neutral, so enable Neutrals or implement teams.
- Targets need a stimuli source: pawns register for sight by default, other actors need `UAIPerceptionStimuliSourceComponent`. Verify on 5.4: the project setting that auto-registers pawns as sight sources.
- The perception updates the Blackboard; the tree reacts through Observer Aborts. Do not drive behaviour directly from the perception callback.

## StateTree on 5.4

Verify availability and maturity on 5.4 before proposing StateTree: the StateTree and GameplayStateTree plugins, `UStateTreeAIComponent`, the AI component schema and the `Run State Tree` BT task changed significantly across 5.2–5.8, and the upstream guidance targets 5.8. Default: keep whatever the project already uses; on 5.4 Behavior Trees are the safer choice for new AI unless the project already ships StateTree.

## Debugging and gotchas (ask the human)

- AI never starts: pawn not possessed by your controller, or `RunBehaviorTree` never ran.
- `MoveTo` fails instantly: no Nav Mesh Bounds Volume, paths not built, or goal off the navmesh.
- Bugs only with several NPCs: per-run state stored in task member variables.
- In PIE, the apostrophe key opens the Gameplay Debugger (active branch, Blackboard values); the Behavior Tree editor highlights the running branch while PIE runs.
- For automated checks, a Functional Test actor in a small test map can wait a few seconds and assert a Blackboard value or distance to target. The human runs it from Session Frontend or the automation command line; the Functional Testing Editor plugin must be enabled.

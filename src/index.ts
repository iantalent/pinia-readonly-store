import {defineStore, skipHydrate} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs, ComputedRef, computed} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C // TODO make state independent. just play object of getters
	actions?: (state: T) => A // TODO make state independent. just play object of actions
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}, X = ReadonlyStoreContext<T, C, A>> =
	ReadonlyStoreState<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A, X>;

export type ReadonlyStoreContext<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	T & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefsDeepReadOnly<T>;

export type ReadonlyStoreGetterProp = Record<string | number | symbol, (() => any)>;

export type ReadonlyStoreGettersRefs<CP extends ReadonlyStoreStateProp> = {
	[K in keyof CP]: ComputedRef<CP[K]>
}

export type ReadonlyStoreGetters<CP extends ReadonlyStoreStateProp> = UnwrapNestedRefs<ReadonlyStoreGettersRefs<CP>>;

export type ReadonlyStoreActionsOld<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp, X extends ReadonlyStoreContext<any, any, A>> = {
	[K in keyof A]: (this: X, ...args: Parameters<A[K]>) => ReturnType<A[K]>
}

export type ReadonlyStoreActionsProp = Record<string | number | symbol, ((...args: any[]) => any)>

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function makeComputed<CP extends ReadonlyStoreGetterProp = {}>(computedProps: CP, context: ReadonlyStoreContext<any, CP, any>): ReadonlyStoreGettersRefs<CP>
{
	const readyComputed = <ReadonlyStoreGettersRefs<CP>>{};
	for(let key in computedProps)
	{
		if(!computedProps.hasOwnProperty(key))
			continue;
		
		readyComputed[key] = computed(computedProps[key].bind(context));
	}
	return readyComputed;
}

function makeActions<AP extends ReadonlyStoreActionsProp, X = ReadonlyStoreContext<any, any, AP>>(actionsProps: AP, context: X): ReadonlyStoreActions<AP, X>
{
	const readyActions = <ReadonlyStoreActions<AP, X>>{};
	for(let key in actionsProps)
	{
		if(!actionsProps.hasOwnProperty(key))
			continue;
		
		readyActions[key] = actionsProps[key].bind(context);
	}
	return readyActions;
}

function addToContext<CP extends ReadonlyStoreGetterProp = {},
	AP extends ReadonlyStoreActionsProp = {}>
(context: ReadonlyStoreContext<any, CP, AP>, member: ReadonlyStoreGetters<CP> | ReadonlyStoreActions<AP, ReadonlyStoreContext<any, CP, AP>>)
{
	for(let k in member)
		context[k] = member[k];
}

function makeStore<TT extends UnwrapNestedRefs<ReadonlyStoreState<T>>,
	C extends ReadonlyStoreGetters<CP>,
	A extends ReadonlyStoreActions<AP, X>,
	T extends ReadonlyStoreStateProp = {},
	CP extends ReadonlyStoreGetterProp = {},
	AP extends ReadonlyStoreActionsProp = {},
	X = ReadonlyStoreContext<T, CP, AP>>(readonlyState: TT, reactiveState: T, getters: CP, actions: A): TT & ReadonlyStoreGettersRefs<CP>
{
	const context = <ReadonlyStoreContext<T, CP, AP>>{...readonlyState};
	const readyComputed = makeComputed(getters, context);
	const readyActions = makeActions(actions, context);
	
	addToContext(context, readyComputed); // make it reactive
	addToContext(context, readyActions);
	
	//return {...readonlyState, ...readyComputed, ...actions};
	return {...readonlyState, ...readyComputed};
}

export function defineReadonlyStore<Id extends string,
	TT extends UnwrapNestedRefs<ReadonlyStoreState<T>>,
	T extends ReadonlyStoreStateProp = {},
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {},
	RS = ReadonlyStore<T, C, A>>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & TT & A>, A & ThisType<A & TT & ReadonlyStoreGetters<C>>>)
{
	return defineStore(options.id, (): RS =>
	{
		const initialState = options.state() || {},
			reactiveState = reactive(initialState),
			readOnlyState = prepareReadonlyState(reactiveState);
		
		const actions = options.actions ? options.actions(reactiveState) : {},
			getters = options.getters ? options.getters(reactiveState) : {}
		
		return makeStore(readOnlyState, reactiveState, getters, actions);
	});
}
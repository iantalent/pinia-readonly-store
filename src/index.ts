import {defineStore, skipHydrate} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";
import {computed, ComputedRef, ref, UnwrapRef} from "vue";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C // TODO make state independent. just play object of getters
	actions?: (state: T) => A // TODO make state independent. just play object of actions
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreState<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefsDeepReadOnly<T>;

export type ReadonlyStoreGetters<C extends ReadonlyStoreGetterProp> = {
	[K in keyof C]: ComputedRef<C[K]>
}

export type ReadonlyStoreGetterProp = Record<any, (() => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActionsProp = Record<any, ((...args: any[]) => void)>

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function makeComputed<CP extends ReadonlyStoreGetterProp>(computedProps: CP): ReadonlyStoreGetters<CP>
{
	const computedContext = <ReadonlyStoreGetters<CP>>{};
	for(let key in computedProps)
	{
		if(!computedProps.hasOwnProperty(key))
			continue;
		
		computedContext[key] = computed(computedProps[key]);
	}
	return computedContext;
}

function makeStore<TT extends UnwrapNestedRefs<ReadonlyStoreState<T>>,
	C extends ReadonlyStoreGetters<CP>,
	A extends ReadonlyStoreActions<AP>,
	T extends ReadonlyStoreStateProp = {},
	CP extends ReadonlyStoreGetterProp = {},
	AP extends ReadonlyStoreActionsProp = {}>(readonlyState: TT, reactiveState: T, getters: CP, actions: A): TT & C & A
{
	const store = {...readonlyState, ...getters, ...actions};
	const readyComputed = makeComputed(getters);
	
	return {...readonlyState, ...readyComputed, ...actions};
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
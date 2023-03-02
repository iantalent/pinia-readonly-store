import {defineStore, skipHydrate} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreState, C extends ReadonlyStoreComputedProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	computed?: (state: T) => C
	actions?: (state: T) => A
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreState = {}, C extends ReadonlyStoreComputedProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ToRefsDeepReadOnly<T> & ReadonlyStoreComputed<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreState = Record<string | number | symbol, any>;

export type ReadonlyStoreComputed<C extends ReadonlyStoreComputedProp> = {
	[K in keyof C]: ReturnType<C[K]>
}

export type ReadonlyStoreComputedProp = Record<any, (() => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActionsProp = Record<any, ((...args: any[]) => void)>

function prepareReadonlyState<T extends ReadonlyStoreState>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function mergeStore<T extends ReadonlyStoreState,
	C extends ReadonlyStoreComputed<CP>,
	CP extends ReadonlyStoreComputedProp,
	A extends ReadonlyStoreActions<AP>,
	AP extends ReadonlyStoreActionsProp>(state: ToRefsDeepReadOnly<T>, computed: C, actions: A): T & C & A
{
	return {...state, ...computed, ...actions};
}

export function defineReadonlyStore<Id extends string,
	T extends ReadonlyStoreState,
	C extends ReadonlyStoreComputedProp,
	A extends ReadonlyStoreActionsProp,
	RT = DeepReadonly<T>>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & RT & A>, A & ThisType<A & RT & ReadonlyStoreComputed<C>>>)
{
	return defineStore(options.id, (): ReadonlyStore<T, C, A> =>
	{
		const initialState = options.state() || {},
			reactiveState = reactive(initialState),
			readOnlyState = prepareReadonlyState(reactiveState);
		
		const actions = options.actions ? options.actions(reactiveState) : {},
			computed = options.computed ? options.computed(reactiveState) : {}
		
		return mergeStore(readOnlyState, computed, actions);
	});
}
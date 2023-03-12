import {defineStore, skipHydrate} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C
	actions?: (state: T) => A
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreState<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefsDeepReadOnly<T>;

export type ReadonlyStoreGetters<C extends ReadonlyStoreGetterProp> = {
	[K in keyof C]: ReturnType<C[K]>
}

export type ReadonlyStoreGetterProp = Record<any, (() => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

export type ReadonlyStoreActionsProp = Record<any, ((...args: any[]) => void)>

type StoreContext<T extends ReadonlyStoreStateProp,
	CC extends ReadonlyStoreGetters<C>,
	AA extends ReadonlyStoreActions<A>,
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {}> =
	T & CC & AA;

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function mergeContext<T extends ReadonlyStoreStateProp,
	CC extends ReadonlyStoreGetters<C>,
	AA extends ReadonlyStoreActions<A>,
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {}>(state: T, getters: C, actions: A): T & CC & AA
{
	return {...state, ...getters, ...actions};
}

function mergeStore<T extends ReadonlyStoreStateProp,
	C extends ReadonlyStoreGetters<CP>,
	CP extends ReadonlyStoreGetterProp,
	A extends ReadonlyStoreActions<AP>,
	AP extends ReadonlyStoreActionsProp>(state: ToRefsDeepReadOnly<T>, getters: C, actions: A): T & C & A
{
	return {...state, ...getters, ...actions};
}

export function defineReadonlyStore<Id extends string,
	T extends ReadonlyStoreStateProp,
	TT extends ReadonlyStoreState<T>,
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
		
		return mergeStore(readOnlyState, getters, actions);
	});
}
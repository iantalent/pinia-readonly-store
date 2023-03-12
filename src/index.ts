import {
	_ExtractActionsFromSetupStore,
	_ExtractGettersFromSetupStore,
	_ExtractStateFromSetupStore,
	defineStore,
	skipHydrate,
	StoreDefinition
} from "pinia";
import {DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C
	actions?: (state: T) => A
}

type ToRefsDeepReadOnly<T> = ToRefs<DeepReadonly<T>>

export type ReadonlyStore<T extends ReadonlyStoreStateProp = any, C extends ReadonlyStoreGetterProp = any, A extends ReadonlyStoreActionsProp = any> =
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

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: T): ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>
{
	const readOnlyState = toRefs(readonly(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
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
	C extends ReadonlyStoreGetterProp,
	A extends ReadonlyStoreActionsProp,
	TT extends ReadonlyStoreState<T>,
	CC extends ReadonlyStoreGetters<C>,
	AA extends ReadonlyStoreActions<A>,
	RS = ReadonlyStore<T, C, A>>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & TT & A>, A & ThisType<A & TT & ReadonlyStoreGetters<C>>>): StoreDefinition<Id, _ExtractStateFromSetupStore<RS>, _ExtractGettersFromSetupStore<RS> | any, _ExtractActionsFromSetupStore<RS>>
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
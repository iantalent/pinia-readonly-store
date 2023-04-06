import {defineStore, skipHydrate} from "pinia";
import {computed, ComputedRef, DeepReadonly, reactive, readonly, ToRefs, toRefs, UnwrapNestedRefs} from "vue-demi";

export interface ReadonlyStoreOptions<I extends string, T extends ReadonlyStoreStateProp, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}>
{
	id: I
	state: () => T
	getters?: (state: T) => C // TODO make state independent. just play object of getters
	actions?: (state: T) => A // TODO make state independent. just play object of actions
}

export type ReadonlyStore<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreState<T> & ReadonlyStoreGettersRefs<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreContext<T extends ReadonlyStoreStateProp = {}, C extends ReadonlyStoreGetterProp = {}, A extends ReadonlyStoreActionsProp = {}> =
	ReadonlyStoreStateReactive<T> & ReadonlyStoreGetters<C> & ReadonlyStoreActions<A>;

export type ReadonlyStoreStateProp = Record<string | number | symbol, any>;

export type ReadonlyStoreState<T extends ReadonlyStoreStateProp> = ToRefs<DeepReadonly<UnwrapNestedRefs<T>>>;

export type ReadonlyStoreStateReactive<T extends ReadonlyStoreStateProp> = UnwrapNestedRefs<T>;

export type ReadonlyStoreGetterProp = Record<string | number | symbol, (() => any)>;

export type ReadonlyStoreGettersRefs<CP extends ReadonlyStoreStateProp> = {
	[K in keyof CP]: ComputedRef<CP[K]>
}

export type ReadonlyStoreGetters<CP extends ReadonlyStoreStateProp> = UnwrapNestedRefs<ReadonlyStoreGettersRefs<CP>>;

export type ReadonlyStoreActionsProp = Record<string | number | symbol, ((...args: any[]) => any)>

export type ReadonlyStoreActions<A extends ReadonlyStoreActionsProp> = {
	[K in keyof A]: A[K]
}

function makeReadonlyReactive<T extends ReadonlyStoreStateProp>(proxy: ReadonlyStoreStateReactive<T>): DeepReadonly<UnwrapNestedRefs<T>>
{
	return readonly(proxy);
}

function prepareReadonlyState<T extends ReadonlyStoreStateProp>(state: ReadonlyStoreStateReactive<T>): ReadonlyStoreState<T>
{
	const readOnlyState = <ReadonlyStoreState<T>>toRefs(makeReadonlyReactive(state));
	let key: keyof typeof state;
	
	for(key in state)
		readOnlyState[key] = skipHydrate(readOnlyState[key]);
	
	return readOnlyState;
}

function addComputedToContext<CP extends ReadonlyStoreGetterProp>(context: ReadonlyStoreContext<any, CP, any>, computed: ReadonlyStoreGettersRefs<CP>)
{
	const unwrappedComputed = reactive(computed);
	
	for(let key in unwrappedComputed)
	{
		if(unwrappedComputed.hasOwnProperty(key))
			context[key] = unwrappedComputed[key];
	}
}

function makeComputed<CP extends ReadonlyStoreGetterProp, XT extends ReadonlyStoreStateProp>(computedProps: CP, context: ReadonlyStoreContext<any, CP>): ReadonlyStoreGettersRefs<CP>
{
	const readyComputed = <ReadonlyStoreGettersRefs<CP>>{};
	for(let key in computedProps)
	{
		if(!computedProps.hasOwnProperty(key))
			continue;
		
		readyComputed[key] = computed(computedProps[key].bind(context));
	}
	
	addComputedToContext(context, readyComputed);
	
	return readyComputed;
}

function makeActions<AP extends ReadonlyStoreActionsProp>(actionsProps: AP, context: ReadonlyStoreContext<any, any, AP>): ReadonlyStoreActions<AP>
{
	const readyActions = <ReadonlyStoreActions<AP>>{};
	let key: keyof AP;
	for(key in actionsProps)
	{
		if(!actionsProps.hasOwnProperty(key))
			continue;
		
		const bindAction = <AP[keyof AP]>actionsProps[key].bind(context);
		readyActions[key] = bindAction;
		context[key] = bindAction;
	}
	return readyActions;
}

function makeStore<TT extends ReadonlyStoreStateReactive<TP>,
	RT extends ReadonlyStoreState<TP>,
	CP extends ReadonlyStoreGetterProp,
	AP extends ReadonlyStoreActionsProp,
	TP extends ReadonlyStoreStateProp = {},
	X = ReadonlyStoreContext<TP, CP, AP>>(readonlyState: RT, reactiveState: TT, getters: CP, actions: AP): RT & ReadonlyStoreGettersRefs<CP> & ReadonlyStoreActions<AP>
{
	const context = <ReadonlyStoreContext<TP, CP, AP>>reactive(reactiveState);
	const readyComputed = makeComputed(getters, context);
	const readyActions = makeActions(actions, context);
	
	return {...readonlyState, ...readyComputed, ...readyActions};
}

export function defineReadonlyStore<Id extends string,
	TT extends ReadonlyStoreState<T>,
	T extends ReadonlyStoreStateProp = {},
	C extends ReadonlyStoreGetterProp = {},
	A extends ReadonlyStoreActionsProp = {}>
(options: ReadonlyStoreOptions<Id, T, C & ThisType<C & TT & A>, A & ThisType<A & TT & ReadonlyStoreGetters<C>>>)
{
	return defineStore(options.id, (): ReadonlyStore<T, C, A> =>
	{
		const initialState = options.state() || {},
			reactiveState = reactive(initialState),
			readOnlyState = prepareReadonlyState(reactiveState),
			computed = options.getters ? options.getters(reactiveState) : <C>{},
			actions = options.actions ? options.actions(reactiveState) : <A>{};
		
		return makeStore(readOnlyState, reactiveState, computed, actions);
	});
}